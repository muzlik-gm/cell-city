import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// Helper: compute outstanding receivable for a customer.
async function computeCustomerBalance(customerId: string): Promise<number> {
  const [sales, repairs] = await Promise.all([
    db.sale.findMany({
      where: { customerId, paymentStatus: { not: "PAID" } },
      select: { total: true, paid: true },
    }),
    db.repairJob.findMany({
      where: { customerId, paymentStatus: { not: "PAID" } },
      select: { total: true, paid: true },
    }),
  ]);
  const salesDue = sales.reduce((sum, s) => sum + (s.total - s.paid), 0);
  const repairDue = repairs.reduce((sum, r) => sum + (r.total - r.paid), 0);
  return salesDue + repairDue;
}

// GET /api/customers/[id] - customer + sales + repair history + outstanding balance
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      },
      repairJobs: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          model: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
      _count: { select: { sales: true, repairJobs: true } },
    },
  });

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const outstandingBalance = await computeCustomerBalance(id);

  return NextResponse.json({ ...customer, outstandingBalance });
}

// PUT /api/customers/[id] - update
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const { name, phone, whatsapp, email, address, company, notes, active } = body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return NextResponse.json({ error: "Customer name cannot be empty" }, { status: 400 });
  }

  const updated = await db.customer.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
      ...(whatsapp !== undefined ? { whatsapp: whatsapp?.trim() || null } : {}),
      ...(email !== undefined ? { email: email?.trim() || null } : {}),
      ...(address !== undefined ? { address: address?.trim() || null } : {}),
      ...(company !== undefined ? { company: company?.trim() || null } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    },
    include: { _count: { select: { sales: true, repairJobs: true } } },
  });

  const outstandingBalance = await computeCustomerBalance(id);

  return NextResponse.json({ ...updated, outstandingBalance });
}

// DELETE /api/customers/[id] - soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  await db.customer.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
