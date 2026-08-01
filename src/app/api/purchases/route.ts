import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/purchases — list with filters (q, paymentStatus, status, supplierId, from, to) + pagination.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const paymentStatus = searchParams.get("paymentStatus");
  const status = searchParams.get("status");
  const supplierId = searchParams.get("supplierId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const where: Prisma.PurchaseWhereInput = {};
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (q) {
    where.OR = [
      { poNo: { contains: q } },
      { supplier: { name: { contains: q } } },
      { supplier: { company: { contains: q } } },
      { notes: { contains: q } },
    ];
  }

  const [total, purchases] = await Promise.all([
    db.purchase.count({ where }),
    db.purchase.findMany({
      where,
      include: {
        supplier: true,
        employee: true,
        items: { include: { product: { include: { brand: true, model: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data: purchases, total, page, pageSize });
}

// Generate PO number PO-YYYYMMDD-NNN
async function generatePoNo(prefix: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;
  const like = `${prefix}-${datePart}-`;
  const count = await db.purchase.count({ where: { poNo: { startsWith: like } } });
  const seq = String(count + 1).padStart(3, "0");
  return `${like}${seq}`;
}

// POST /api/purchases — create purchase with auto poNo, add stock, update product cost + price history.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    supplierId, items, discount, tax, paymentStatus, notes, userId,
  } = body as {
    supplierId?: string;
    items: { productId: string; qty: number; cost: number }[];
    discount?: number;
    tax?: number;
    paymentStatus?: string;
    notes?: string;
    userId?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one purchase item is required" }, { status: 400 });
  }

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const anyUser = await db.employee.findFirst({ orderBy: { createdAt: "asc" } });
    resolvedUserId = anyUser?.id ?? null;
  }

  // Fetch products
  const productIds = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { warehouse: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const it of items) {
    if (!productMap.has(it.productId)) {
      return NextResponse.json({ error: `Product not found: ${it.productId}` }, { status: 404 });
    }
  }

  // Compute totals
  let subtotal = 0;
  const purchaseItemsData: {
    productId: string;
    name: string;
    qty: number;
    cost: number;
    price: number;
    total: number;
  }[] = [];

  for (const it of items) {
    const p = productMap.get(it.productId)!;
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    const cost = Math.max(0, Number(it.cost) || 0);
    const lineTotal = qty * cost;
    subtotal += lineTotal;
    purchaseItemsData.push({
      productId: p.id,
      name: p.name,
      qty,
      cost,
      price: p.sellingPrice,
      total: lineTotal,
    });
  }

  const overallDiscount = Math.max(0, Number(discount) || 0);
  const taxAmount = Math.max(0, Number(tax) || 0);
  const total = Math.max(0, subtotal - overallDiscount + taxAmount);
  const paid = paymentStatus === "PAID" ? total : paymentStatus === "PARTIAL" ? Math.min(total, Number(body.paid) || 0) : 0;

  const poNo = await generatePoNo("PO");

  const purchase = await db.purchase.create({
    data: {
      poNo,
      supplierId: supplierId || null,
      employeeId: resolvedUserId ?? null,
      subtotal,
      discount: overallDiscount,
      tax: taxAmount,
      total,
      paid,
      paymentStatus: paymentStatus ?? "UNPAID",
      status: "RECEIVED",
      notes: notes ?? null,
      items: { create: purchaseItemsData },
    },
    include: {
      supplier: true,
      employee: true,
      items: { include: { product: { include: { brand: true, model: true } } } },
    },
  });

  // Add stock + inventory movements + price history + update product purchasePrice
  await Promise.all(
    purchaseItemsData.map(async (it) => {
      const p = productMap.get(it.productId)!;
      await db.product.update({
        where: { id: it.productId },
        data: {
          stock: { increment: it.qty },
          purchasePrice: it.cost,
          supplierId: supplierId ?? p.supplierId,
        },
      });
      await db.priceHistory.create({
        data: {
          productId: it.productId,
          supplierId: supplierId ?? null,
          purchasePrice: it.cost,
          sellingPrice: p.sellingPrice,
          note: `Purchase ${poNo}`,
        },
      });
    })
  );

  await db.inventoryMovement.createMany({
    data: purchaseItemsData.map((it) => ({
      productId: it.productId,
      toWarehouseId: productMap.get(it.productId)?.warehouseId ?? null,
      qty: it.qty,
      type: "PURCHASE",
      ref: poNo,
      employeeId: resolvedUserId ?? null,
      note: `Purchase ${poNo}`,
    })),
  });

  return NextResponse.json(purchase, { status: 201 });
}
