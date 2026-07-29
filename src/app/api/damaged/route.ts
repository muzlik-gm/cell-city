import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/damaged — list with filters (reason, productId, from, to) + includes product.
// Pagination via page/pageSize.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reason = searchParams.get("reason");
  const productId = searchParams.get("productId");
  const q = searchParams.get("q") ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const where: Prisma.DamagedInventoryWhereInput = {};
  if (reason) where.reason = reason;
  if (productId) where.productId = productId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  if (q) {
    where.OR = [
      { note: { contains: q,  } },
      { reason: { contains: q,  } },
      { product: { name: { contains: q,  } } },
      { product: { sku: { contains: q,  } } },
      { product: { brand: { name: { contains: q,  } } } },
      { product: { model: { name: { contains: q,  } } } },
    ];
  }

  const [total, items] = await Promise.all([
    db.damagedInventory.count({ where }),
    db.damagedInventory.findMany({
      where,
      include: {
        product: {
          include: { brand: true, model: true, partType: true, warehouse: true },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data: items, total, page, pageSize });
}

// POST /api/damaged — record damage: deduct stock + create DamagedInventory + InventoryMovement(DAMAGE).
// Body: { productId, qty, reason, note?, imageUrl? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { productId, qty, reason, note, imageUrl } = body as {
    productId?: string;
    qty?: number;
    reason?: string;
    note?: string;
    imageUrl?: string;
  };

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }
  const qtyN = Math.max(1, Math.floor(Number(qty) || 0));
  if (qtyN <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { warehouse: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (product.stock < qtyN) {
    return NextResponse.json(
      { error: `Insufficient stock. Available: ${product.stock}, requested: ${qtyN}` },
      { status: 400 }
    );
  }

  // Transaction: deduct stock + create damage record + create movement.
  const [damage] = await db.$transaction([
    db.damagedInventory.create({
      data: {
        productId,
        qty: qtyN,
        reason,
        note: note?.trim() || null,
        imageUrl: imageUrl || null,
        date: new Date(),
      },
      include: {
        product: { include: { brand: true, model: true, partType: true, warehouse: true } },
      },
    }),
    db.product.update({
      where: { id: productId },
      data: { stock: { decrement: qtyN } },
    }),
    db.inventoryMovement.create({
      data: {
        productId,
        fromWarehouseId: product.warehouseId ?? null,
        qty: qtyN,
        type: "DAMAGE",
        ref: reason,
        note: note?.trim() || `Damaged: ${reason}`,
      },
    }),
  ]);

  return NextResponse.json(damage, { status: 201 });
}
