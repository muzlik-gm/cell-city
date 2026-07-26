import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/transfers — list TRANSFER movements with filters + pagination.
//   Filters: productId, fromWarehouseId, toWarehouseId, from (date), to (date).
//   Includes: product (brand/model), fromWarehouse, toWarehouse, user.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const fromWarehouseId = searchParams.get("fromWarehouseId");
  const toWarehouseId = searchParams.get("toWarehouseId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const where: Prisma.InventoryMovementWhereInput = { type: "TRANSFER" };
  if (productId) where.productId = productId;
  if (fromWarehouseId) where.fromWarehouseId = fromWarehouseId;
  if (toWarehouseId) where.toWarehouseId = toWarehouseId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const [total, movements] = await Promise.all([
    db.inventoryMovement.count({ where }),
    db.inventoryMovement.findMany({
      where,
      include: {
        product: { include: { brand: true, model: true, partType: true } },
        fromWarehouse: true,
        toWarehouse: true,
        user: true,
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Stats: total transfers this month, total units moved, active warehouses.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthWhere: Prisma.InventoryMovementWhereInput = {
    type: "TRANSFER",
    date: { gte: monthStart },
  };
  const monthAgg = await db.inventoryMovement.aggregate({
    where: monthWhere,
    _sum: { qty: true },
    _count: { _all: true },
  });
  const activeWarehouseRows = await db.inventoryMovement.findMany({
    where: { type: "TRANSFER" },
    select: { fromWarehouseId: true, toWarehouseId: true },
  });
  const activeWarehouses = new Set<string>();
  for (const r of activeWarehouseRows) {
    if (r.fromWarehouseId) activeWarehouses.add(r.fromWarehouseId);
    if (r.toWarehouseId) activeWarehouses.add(r.toWarehouseId);
  }

  return NextResponse.json({
    data: movements,
    total,
    page,
    pageSize,
    stats: {
      thisMonth: monthAgg._count._all,
      unitsMoved: monthAgg._sum.qty ?? 0,
      activeWarehouses: activeWarehouses.size,
    },
  });
}

// POST /api/transfers — create a TRANSFER movement.
//   Body: { productId, fromWarehouseId, toWarehouseId, qty, note?, userId? }
//   Validation:
//     - Product must exist (and not be deleted)
//     - fromWarehouseId and toWarehouseId must differ
//     - qty > 0
//     - Stock available (note: stock tracked at product level — see comment)
//   Side effect: optionally update product.warehouseId/shelfId to destination if entire
//   batch moves (representing the bin location of this batch). Stock at product level is
//   unchanged because the schema tracks stock at the product level, not per-warehouse.
//   Returns the created movement with relations.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { productId, fromWarehouseId, toWarehouseId, qty, note, userId } = body as {
    productId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    qty?: number;
    note?: string;
    userId?: string;
  };

  if (!productId) {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
  }
  if (!fromWarehouseId || !toWarehouseId) {
    return NextResponse.json(
      { error: "Source and destination warehouses are required" },
      { status: 400 }
    );
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json(
      { error: "Source and destination warehouses must be different" },
      { status: 400 }
    );
  }
  const qtyNum = Math.max(0, Math.floor(Number(qty) || 0));
  if (qtyNum <= 0) {
    return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { warehouse: true, shelf: true },
  });
  if (!product || !product.active) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (product.stock < qtyNum) {
    return NextResponse.json(
      {
        error: `Insufficient stock. Available: ${product.stock}, requested: ${qtyNum}. (Stock is tracked at the product level — transferring records the movement for audit and updates the product's bin location.)`,
      },
      { status: 400 }
    );
  }

  // Verify source/destination warehouses.
  const [fromWh, toWh] = await Promise.all([
    db.warehouse.findUnique({ where: { id: fromWarehouseId } }),
    db.warehouse.findUnique({ where: { id: toWarehouseId } }),
  ]);
  if (!fromWh || !fromWh.active) {
    return NextResponse.json({ error: "Source warehouse not found" }, { status: 404 });
  }
  if (!toWh || !toWh.active) {
    return NextResponse.json({ error: "Destination warehouse not found" }, { status: 404 });
  }

  // Resolve user
  let resolvedUserId: string | null = userId ?? null;
  if (!resolvedUserId) {
    const anyUser = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
    resolvedUserId = anyUser?.id ?? null;
  }

  // Generate a transfer reference: TRF-YYYYMMDD-NNN
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const like = `TRF-${y}${m}${d}-`;
  const count = await db.inventoryMovement.count({
    where: { type: "TRANSFER", ref: { startsWith: like } },
  });
  const ref = `${like}${String(count + 1).padStart(3, "0")}`;

  // Create the transfer movement. Stock is NOT decremented because the schema tracks
  // stock at the product level (single warehouseId + shelfId + stock) — the product
  // is the unit, not a per-warehouse bin.
  const movement = await db.inventoryMovement.create({
    data: {
      productId: product.id,
      fromWarehouseId,
      toWarehouseId,
      qty: qtyNum,
      type: "TRANSFER",
      ref,
      userId: resolvedUserId ?? null,
      note: note?.trim() || `Transfer ${ref}`,
    },
    include: {
      product: { include: { brand: true, model: true, partType: true } },
      fromWarehouse: true,
      toWarehouse: true,
      user: true,
    },
  });

  // If the entire stock is being moved, update the product's bin location to the
  // destination warehouse. (We do NOT change stock count — same product, same stock,
  // just relocated.)
  if (qtyNum >= product.stock) {
    await db.product.update({
      where: { id: product.id },
      data: { warehouseId: toWarehouseId, shelfId: null },
    });
  }

  return NextResponse.json(movement, { status: 201 });
}
