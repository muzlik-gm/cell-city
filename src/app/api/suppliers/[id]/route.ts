import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// Helper: compute outstanding payable for a supplier from purchases.
async function computeSupplierBalance(supplierId: string): Promise<number> {
  const purchases = await db.purchase.findMany({
    where: { supplierId, paymentStatus: { not: "PAID" } },
    select: { total: true, paid: true },
  });
  return purchases.reduce((sum, p) => sum + (p.total - p.paid), 0);
}

// GET /api/suppliers/[id] - supplier + recent purchases (with items) + products supplied + price history
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      },
      products: {
        where: { active: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          brand: { select: { name: true } },
          partType: { select: { name: true } },
        },
      },
      priceHistory: {
        orderBy: { date: "desc" },
        take: 30,
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
      _count: { select: { purchases: true, products: true } },
    },
  });

  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const outstandingBalance = await computeSupplierBalance(id);

  return NextResponse.json({ ...supplier, outstandingBalance });
}

// PUT /api/suppliers/[id] - update
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const {
    name, company, phone, whatsapp, email, address, contactPerson,
    rating, notes, active,
  } = body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return NextResponse.json({ error: "Supplier name cannot be empty" }, { status: 400 });
  }

  let ratingVal: number | undefined;
  if (rating != null && rating !== "") {
    ratingVal = Math.max(1, Math.min(5, Number(rating)));
    if (isNaN(ratingVal)) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }
  }

  const updated = await db.supplier.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(company !== undefined ? { company: company?.trim() || null } : {}),
      ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
      ...(whatsapp !== undefined ? { whatsapp: whatsapp?.trim() || null } : {}),
      ...(email !== undefined ? { email: email?.trim() || null } : {}),
      ...(address !== undefined ? { address: address?.trim() || null } : {}),
      ...(contactPerson !== undefined ? { contactPerson: contactPerson?.trim() || null } : {}),
      ...(ratingVal !== undefined ? { rating: ratingVal } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    },
    include: { _count: { select: { purchases: true, products: true } } },
  });

  const outstandingBalance = await computeSupplierBalance(id);

  return NextResponse.json({ ...updated, outstandingBalance });
}

// DELETE /api/suppliers/[id] - soft delete (set active false)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  await db.supplier.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
