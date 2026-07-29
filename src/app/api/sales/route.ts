import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";
import { Prisma } from "@prisma/client";

// GET /api/sales — list with filters (q, paymentStatus, status, customerId, from, to) + pagination.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const paymentStatus = searchParams.get("paymentStatus");
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const where: Prisma.SaleWhereInput = {};
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (q) {
    where.OR = [
      { invoiceNo: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, sales] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      include: {
        customer: true,
        user: true,
        items: { include: { product: { include: { brand: true, model: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data: sales, total, page, pageSize });
}

// Generate invoice number INV-YYYYMMDD-NNN where NNN is sequence for the day.
async function generateInvoiceNo(prefix: string): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;
  const like = `${prefix}-${datePart}-`;
  const count = await db.sale.count({ where: { invoiceNo: { startsWith: like } } });
  const seq = String(count + 1).padStart(3, "0");
  return `${like}${seq}`;
}

// POST /api/sales — create sale with auto invoiceNo, stock deduction, profit calc.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    customerId, items, discount, tax, paymentMethod, paymentStatus, notes, userId,
  } = body as {
    customerId?: string;
    items: { productId: string; qty: number; price: number; discount?: number }[];
    discount?: number;
    tax?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    notes?: string;
    userId?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one sale item is required" }, { status: 400 });
  }

  // Resolve user: explicit userId, else first OWNER/SALES_STAFF as fallback (no auth wired in).
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const anyUser = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
    resolvedUserId = anyUser?.id ?? null;
  }

  // Fetch products and validate stock
  const productIds = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: { warehouse: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const it of items) {
    const p = productMap.get(it.productId);
    if (!p) {
      return NextResponse.json({ error: `Product not found: ${it.productId}` }, { status: 404 });
    }
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    if (p.stock < qty) {
      return NextResponse.json(
        { error: `Insufficient stock for ${p.name}. Available: ${p.stock}, requested: ${qty}` },
        { status: 400 }
      );
    }
  }

  // Compute totals
  let subtotal = 0;
  let costTotal = 0;
  const saleItemsData: {
    productId: string;
    name: string;
    qty: number;
    price: number;
    cost: number;
    discount: number;
    total: number;
  }[] = [];

  for (const it of items) {
    const p = productMap.get(it.productId)!;
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0));
    const price = Number(it.price) || 0;
    const lineDiscount = Math.max(0, Number(it.discount) || 0);
    const lineTotal = Math.max(0, qty * price - lineDiscount);
    subtotal += qty * price;
    costTotal += qty * p.purchasePrice;
    saleItemsData.push({
      productId: p.id,
      name: p.name,
      qty,
      price,
      cost: p.purchasePrice,
      discount: lineDiscount,
      total: lineTotal,
    });
  }

  const overallDiscount = Math.max(0, Number(discount) || 0);
  const taxAmount = Math.max(0, Number(tax) || 0);
  // Distribute overall discount proportionally for the total
  const itemsNet = subtotal - saleItemsData.reduce((s, i) => s + i.discount, 0);
  const total = Math.max(0, itemsNet - overallDiscount + taxAmount);
  const profit = (itemsNet - overallDiscount) - costTotal;
  const payment = paymentStatus === "PAID" ? total : paymentStatus === "PARTIAL" ? Math.min(total, Number(body.paid) || 0) : 0;

  const invoiceNo = await generateInvoiceNo("INV");

  const sale = await db.sale.create({
    data: {
      invoiceNo,
      customerId: customerId || null,
      userId: resolvedUserId ?? null,
      subtotal,
      discount: overallDiscount + saleItemsData.reduce((s, i) => s + i.discount, 0),
      tax: taxAmount,
      total,
      profit,
      paid: payment,
      paymentMethod: paymentMethod ?? "CASH",
      paymentStatus: paymentStatus ?? "PAID",
      status: "COMPLETED",
      notes: notes ?? null,
      items: { create: saleItemsData },
    },
    include: {
      customer: true,
      user: true,
      items: { include: { product: { include: { brand: true, model: true } } } },
    },
  });

  // Deduct stock + create inventory movements
  await Promise.all(
    saleItemsData.map((it) =>
      db.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.qty } },
      })
    )
  );
  await db.inventoryMovement.createMany({
    data: saleItemsData.map((it) => ({
      productId: it.productId,
      fromWarehouseId: productMap.get(it.productId)?.warehouseId ?? null,
      qty: it.qty,
      type: "SALE",
      ref: invoiceNo,
      userId: resolvedUserId ?? null,
      note: `Sale ${invoiceNo}`,
    })),
  });

  return NextResponse.json(sale, { status: 201 });
}
