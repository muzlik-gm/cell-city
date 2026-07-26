import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────

function recomputePaymentStatus(paid: number, total: number): "PAID" | "PARTIAL" | "UNPAID" {
  if (paid >= total && total > 0) return "PAID";
  if (paid <= 0) return "UNPAID";
  return "PARTIAL";
}

const VALID_METHODS = new Set(["CASH", "CARD", "BANK", "MOBILE", "CREDIT"]);

// GET /api/payments — list with filters (partyType, partyId, method, from, to, q)
// + pagination. Each row includes the resolved party name + linked invoice/PO.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const partyType = searchParams.get("partyType"); // CUSTOMER | SUPPLIER
  const partyId = searchParams.get("partyId");
  const method = searchParams.get("method");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

  const where: Prisma.PaymentWhereInput = {};
  if (partyType) where.partyType = partyType;
  if (partyId) where.partyId = partyId;
  if (method) where.method = method;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) {
      // Include the entire `to` day.
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      where.date.lte = t;
    }
  }

  // Note: payment has no free-text field besides note — q filters on note + linked invoice/PO via party name.
  // To keep the list query simple, we fetch by basic filters first, then enrich client-side.

  const [total, payments] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  // Enrich: resolve party names + linked invoice/PO numbers in a single batched lookup.
  const customerIds = payments.filter((p) => p.partyType === "CUSTOMER").map((p) => p.partyId);
  const supplierIds = payments.filter((p) => p.partyType === "SUPPLIER").map((p) => p.partyId);
  const saleIds = payments.map((p) => p.saleId).filter(Boolean) as string[];
  const purchaseIds = payments.map((p) => p.purchaseId).filter(Boolean) as string[];

  const [customers, suppliers, sales, purchases] = await Promise.all([
    customerIds.length ? db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true, phone: true } }) : Promise.resolve([]),
    supplierIds.length ? db.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true, company: true } }) : Promise.resolve([]),
    saleIds.length ? db.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true, invoiceNo: true } }) : Promise.resolve([]),
    purchaseIds.length ? db.purchase.findMany({ where: { id: { in: purchaseIds } }, select: { id: true, poNo: true } }) : Promise.resolve([]),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const saleMap = new Map(sales.map((s) => [s.id, s.invoiceNo]));
  const purchaseMap = new Map(purchases.map((p) => [p.id, p.poNo]));

  let data = payments.map((p) => {
    const customer = p.partyType === "CUSTOMER" ? customerMap.get(p.partyId) : null;
    const supplier = p.partyType === "SUPPLIER" ? supplierMap.get(p.partyId) : null;
    return {
      ...p,
      partyName: customer?.name ?? supplier?.name ?? "Unknown",
      partySub: customer?.phone ?? supplier?.company ?? null,
      invoiceNo: p.saleId ? saleMap.get(p.saleId) ?? null : null,
      poNo: p.purchaseId ? purchaseMap.get(p.purchaseId) ?? null : null,
    };
  });

  // Client-side `q` filtering on the enriched fields (note, party name, invoice/PO).
  if (q) {
    const needle = q.toLowerCase();
    data = data.filter(
      (p) =>
        (p.note ?? "").toLowerCase().includes(needle) ||
        p.partyName.toLowerCase().includes(needle) ||
        (p.invoiceNo ?? "").toLowerCase().includes(needle) ||
        (p.poNo ?? "").toLowerCase().includes(needle)
    );
  }

  return NextResponse.json({ data, total: q ? data.length : total, page, pageSize });
}

// POST /api/payments — record a payment.
// Body: { partyType, partyId, saleId?, purchaseId?, amount, method, note }
// Side-effects: increments sale.paid or purchase.paid, recomputes paymentStatus,
// and decrements the customer/supplier `balance` field accordingly.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    partyType, partyId, saleId, purchaseId, amount, method, note,
  } = body as {
    partyType?: string;
    partyId?: string;
    saleId?: string | null;
    purchaseId?: string | null;
    amount?: number;
    method?: string;
    note?: string;
  };

  // ── Validate ─────────────────────────────────────────────────────────
  if (!partyType || (partyType !== "CUSTOMER" && partyType !== "SUPPLIER")) {
    return NextResponse.json({ error: "partyType must be CUSTOMER or SUPPLIER" }, { status: 400 });
  }
  if (!partyId || typeof partyId !== "string") {
    return NextResponse.json({ error: "partyId is required" }, { status: 400 });
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  const m = method && VALID_METHODS.has(method) ? method : "CASH";
  if (saleId && purchaseId) {
    return NextResponse.json({ error: "Cannot link a payment to both a sale and a purchase" }, { status: 400 });
  }
  if (partyType === "CUSTOMER" && purchaseId) {
    return NextResponse.json({ error: "Customer payments cannot link to a purchase" }, { status: 400 });
  }
  if (partyType === "SUPPLIER" && saleId) {
    return NextResponse.json({ error: "Supplier payments cannot link to a sale" }, { status: 400 });
  }

  // ── Resolve party ─────────────────────────────────────────────────────
  if (partyType === "CUSTOMER") {
    const customer = await db.customer.findUnique({ where: { id: partyId } });
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  } else {
    const supplier = await db.supplier.findUnique({ where: { id: partyId } });
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  // ── Optional linked sale/purchase validation ─────────────────────────
  let sale: { id: string; total: number; paid: number; customerId: string | null } | null = null;
  let purchase: { id: string; total: number; paid: number; supplierId: string | null } | null = null;
  if (saleId) {
    sale = await db.sale.findUnique({ where: { id: saleId }, select: { id: true, total: true, paid: true, customerId: true } });
    if (!sale) return NextResponse.json({ error: "Linked sale not found" }, { status: 404 });
    if (sale.customerId && sale.customerId !== partyId) {
      return NextResponse.json({ error: "Linked sale does not belong to this customer" }, { status: 400 });
    }
  }
  if (purchaseId) {
    purchase = await db.purchase.findUnique({ where: { id: purchaseId }, select: { id: true, total: true, paid: true, supplierId: true } });
    if (!purchase) return NextResponse.json({ error: "Linked purchase not found" }, { status: 404 });
    if (purchase.supplierId && purchase.supplierId !== partyId) {
      return NextResponse.json({ error: "Linked purchase does not belong to this supplier" }, { status: 400 });
    }
  }

  // ── Apply payment in a transaction ───────────────────────────────────
  const payment = await db.$transaction(async (tx) => {
    // 1) Create the Payment record.
    const created = await tx.payment.create({
      data: {
        partyType,
        partyId,
        saleId: saleId || null,
        purchaseId: purchaseId || null,
        amount: amt,
        method: m,
        note: note?.trim() || null,
      },
    });

    // 2) Update linked sale (increment paid, recompute status).
    if (sale) {
      const newPaid = +(sale.paid + amt).toFixed(2);
      const status = recomputePaymentStatus(newPaid, sale.total);
      await tx.sale.update({
        where: { id: sale.id },
        data: { paid: newPaid, paymentStatus: status },
      });
    }

    // 3) Update linked purchase (increment paid, recompute status).
    if (purchase) {
      const newPaid = +(purchase.paid + amt).toFixed(2);
      const status = recomputePaymentStatus(newPaid, purchase.total);
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { paid: newPaid, paymentStatus: status },
      });
    }

    // 4) Decrement the party's outstanding balance field.
    if (partyType === "CUSTOMER") {
      await tx.customer.update({
        where: { id: partyId },
        data: { balance: { decrement: amt } },
      });
    } else {
      await tx.supplier.update({
        where: { id: partyId },
        data: { balance: { decrement: amt } },
      });
    }

    return created;
  });

  return NextResponse.json(payment, { status: 201 });
}
