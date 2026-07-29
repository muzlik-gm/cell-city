import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";
import { Prisma } from "@prisma/client";

// Helper: compute outstanding receivable for a customer.
// Outstanding = sum(total - paid) across sales where paymentStatus != "PAID"
//             + sum(total - paid) across repairJobs where paymentStatus != "PAID"
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

// GET /api/customers - list with search + outstanding balance + counts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const activeOnly = searchParams.get("active") !== "false";

  const where: Prisma.CustomerWhereInput = {};
  if (activeOnly) where.active = true;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { company: { contains: q } },
      { phone: { contains: q } },
      { whatsapp: { contains: q } },
      { email: { contains: q } },
      { address: { contains: q } },
    ];
  }

  const customers = await db.customer.findMany({
    where,
    include: {
      _count: { select: { sales: true, repairJobs: true } },
    },
    orderBy: [{ name: "asc" }],
  });

  // Aggregate outstanding balances per customer
  const customerIds = customers.map((c) => c.id);
  const [unpaidSales, unpaidRepairs] = await Promise.all([
    db.sale.findMany({
      where: { customerId: { in: customerIds }, paymentStatus: { not: "PAID" } },
      select: { customerId: true, total: true, paid: true },
    }),
    db.repairJob.findMany({
      where: { customerId: { in: customerIds }, paymentStatus: { not: "PAID" } },
      select: { customerId: true, total: true, paid: true },
    }),
  ]);

  const balanceMap = new Map<string, number>();
  const salesCountMap = new Map<string, number>();
  for (const s of unpaidSales) {
    const cid = s.customerId ?? "";
    balanceMap.set(cid, (balanceMap.get(cid) ?? 0) + (s.total - s.paid));
    salesCountMap.set(cid, (salesCountMap.get(cid) ?? 0) + 1);
  }
  for (const r of unpaidRepairs) {
    const cid = r.customerId ?? "";
    balanceMap.set(cid, (balanceMap.get(cid) ?? 0) + (r.total - r.paid));
  }

  const data = customers.map((c) => ({
    ...c,
    outstandingBalance: balanceMap.get(c.id) ?? 0,
  }));

  return NextResponse.json(data);
}

// POST /api/customers - create
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, whatsapp, email, address, company, notes } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }

  const customer = await db.customer.create({
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      whatsapp: whatsapp?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
    },
    include: { _count: { select: { sales: true, repairJobs: true } } },
  });

  const outstandingBalance = await computeCustomerBalance(customer.id);

  return NextResponse.json({ ...customer, outstandingBalance }, { status: 201 });
}
