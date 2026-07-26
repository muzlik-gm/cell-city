import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Helper: compute outstanding payable for a supplier from purchases.
// Outstanding = sum(total - paid) across purchases where paymentStatus != "PAID".
async function computeSupplierBalance(supplierId: string): Promise<number> {
  const purchases = await db.purchase.findMany({
    where: { supplierId, paymentStatus: { not: "PAID" } },
    select: { total: true, paid: true },
  });
  return purchases.reduce((sum, p) => sum + (p.total - p.paid), 0);
}

// GET /api/suppliers - list with search + outstanding balance + counts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const activeOnly = searchParams.get("active") !== "false";

  const where: Prisma.SupplierWhereInput = {};
  if (activeOnly) where.active = true;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { company: { contains: q } },
      { phone: { contains: q } },
      { whatsapp: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { contactPerson: { contains: q } },
      { address: { contains: q } },
    ];
  }

  const suppliers = await db.supplier.findMany({
    where,
    include: {
      _count: { select: { purchases: true, products: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  // Compute outstanding balance per supplier (only those with unpaid purchases)
  const unpaidPurchases = await db.purchase.findMany({
    where: {
      supplierId: { in: suppliers.map((s) => s.id) },
      paymentStatus: { not: "PAID" },
    },
    select: { supplierId: true, total: true, paid: true },
  });
  const balanceMap = new Map<string, number>();
  for (const p of unpaidPurchases) {
    balanceMap.set(p.supplierId ?? "", (balanceMap.get(p.supplierId ?? "") ?? 0) + (p.total - p.paid));
  }

  // Sync balance field in DB if drifted (best-effort, non-blocking)
  // We return computed outstandingBalance as the source of truth.
  const data = suppliers.map((s) => ({
    ...s,
    outstandingBalance: balanceMap.get(s.id) ?? 0,
  }));

  return NextResponse.json(data);
}

// POST /api/suppliers - create
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name, company, phone, whatsapp, email, address, contactPerson,
    rating, notes,
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
  }

  const ratingVal = rating != null && rating !== "" ? Math.max(1, Math.min(5, Number(rating))) : 3;
  if (isNaN(ratingVal)) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  const supplier = await db.supplier.create({
    data: {
      name: name.trim(),
      company: company?.trim() || null,
      phone: phone?.trim() || null,
      whatsapp: whatsapp?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      contactPerson: contactPerson?.trim() || null,
      rating: ratingVal,
      notes: notes?.trim() || null,
    },
    include: { _count: { select: { purchases: true, products: true } } },
  });

  const outstandingBalance = await computeSupplierBalance(supplier.id);

  return NextResponse.json({ ...supplier, outstandingBalance }, { status: 201 });
}
