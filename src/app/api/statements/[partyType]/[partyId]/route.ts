import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params {
  params: Promise<{ partyType: string; partyId: string }>;
}

// ─── Types ───────────────────────────────────────────────────────────────
type TxType = "sale" | "payment" | "repair" | "purchase";

interface TxRow {
  date: Date;
  type: TxType;
  ref: string;
  description: string;
  debit: number;
  credit: number;
}

interface StatementResponse {
  party: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    contactPerson?: string | null;
    balance: number;
    createdAt: Date;
  };
  partyType: "customer" | "supplier";
  period: { from: string | null; to: string | null };
  openingBalance: number;
  closingBalance: number;
  transactions: Array<{
    date: string;
    type: TxType;
    ref: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    txCount: number;
  };
}

// GET /api/statements/[partyType]/[partyId]
// Returns a full customer or supplier statement with running balance.
// Optional query params: ?from=ISO&to=ISO — date range filter (period). The
// opening balance is the sum of all transactions BEFORE `from`.
export async function GET(req: NextRequest, { params }: Params) {
  const { partyType: ptRaw, partyId } = await params;
  const partyType = ptRaw.toLowerCase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (partyType !== "customer" && partyType !== "supplier") {
    return NextResponse.json(
      { error: "partyType must be 'customer' or 'supplier'" },
      { status: 400 }
    );
  }
  if (!partyId) {
    return NextResponse.json({ error: "partyId is required" }, { status: 400 });
  }

  // Parse date range (inclusive of the entire `to` day).
  let fromDate: Date | null = null;
  let toDate: Date | null = null;
  if (from) {
    fromDate = new Date(from);
    if (isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: "Invalid `from` date" }, { status: 400 });
    }
  }
  if (to) {
    toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid `to` date" }, { status: 400 });
    }
    toDate.setHours(23, 59, 59, 999);
  }

  if (partyType === "customer") {
    const customer = await db.customer.findUnique({ where: { id: partyId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const [sales, repairs, payments] = await Promise.all([
      db.sale.findMany({
        where: { customerId: partyId, status: { not: "RETURNED" } },
        select: {
          id: true,
          invoiceNo: true,
          total: true,
          createdAt: true,
          status: true,
        },
      }),
      db.repairJob.findMany({
        where: { customerId: partyId, status: { not: "CANCELLED" } },
        select: {
          id: true,
          ticketNo: true,
          total: true,
          createdAt: true,
          status: true,
          problem: true,
        },
      }),
      db.payment.findMany({
        where: { partyType: "CUSTOMER", partyId },
        select: {
          id: true,
          amount: true,
          method: true,
          note: true,
          date: true,
          saleId: true,
        },
      }),
    ]);

    const txs: TxRow[] = [];
    for (const s of sales) {
      txs.push({
        date: s.createdAt,
        type: "sale",
        ref: s.invoiceNo,
        description: `Invoice ${s.invoiceNo}${
          s.status !== "COMPLETED" ? ` (${s.status.toLowerCase()})` : ""
        }`,
        debit: Number(s.total) || 0,
        credit: 0,
      });
    }
    for (const r of repairs) {
      const desc =
        r.problem && r.problem.length > 60
          ? `${r.problem.slice(0, 57)}…`
          : r.problem || "Repair job";
      txs.push({
        date: r.createdAt,
        type: "repair",
        ref: r.ticketNo,
        description: `Repair ${r.ticketNo} — ${desc}`,
        debit: Number(r.total) || 0,
        credit: 0,
      });
    }
    for (const p of payments) {
      txs.push({
        date: p.date,
        type: "payment",
        ref: p.saleId ? `PAY-${p.id.slice(-6)}` : `PAY-${p.id.slice(-6)}`,
        description: `Payment received via ${p.method}${
          p.note ? ` — ${p.note}` : ""
        }`,
        debit: 0,
        credit: Number(p.amount) || 0,
      });
    }

    return buildStatement(
      {
        id: customer.id,
        name: customer.name,
        company: customer.company,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        balance: customer.balance,
        createdAt: customer.createdAt,
      },
      "customer",
      txs,
      fromDate,
      toDate
    );
  }

  // supplier
  const supplier = await db.supplier.findUnique({ where: { id: partyId } });
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  const [purchases, payments] = await Promise.all([
    db.purchase.findMany({
      where: { supplierId: partyId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        poNo: true,
        total: true,
        createdAt: true,
        status: true,
      },
    }),
    db.payment.findMany({
      where: { partyType: "SUPPLIER", partyId },
      select: {
        id: true,
        amount: true,
        method: true,
        note: true,
        date: true,
        purchaseId: true,
      },
    }),
  ]);

  const txs: TxRow[] = [];
  for (const p of purchases) {
    txs.push({
      date: p.createdAt,
      type: "purchase",
      ref: p.poNo,
      description: `Purchase Order ${p.poNo}${
        p.status !== "RECEIVED" ? ` (${p.status.toLowerCase()})` : ""
      }`,
      debit: Number(p.total) || 0,
      credit: 0,
    });
  }
  for (const p of payments) {
    txs.push({
      date: p.date,
      type: "payment",
      ref: `PAY-${p.id.slice(-6)}`,
      description: `Payment made via ${p.method}${
        p.note ? ` — ${p.note}` : ""
      }`,
      debit: 0,
      credit: Number(p.amount) || 0,
    });
  }

  return buildStatement(
    {
      id: supplier.id,
      name: supplier.name,
      company: supplier.company,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      contactPerson: supplier.contactPerson,
      balance: supplier.balance,
      createdAt: supplier.createdAt,
    },
    "supplier",
    txs,
    fromDate,
    toDate
  );
}

// ─── Builder ─────────────────────────────────────────────────────────────
function buildStatement(
  party: StatementResponse["party"],
  partyType: "customer" | "supplier",
  txs: TxRow[],
  fromDate: Date | null,
  toDate: Date | null
): NextResponse<StatementResponse> {
  // Sort all transactions by date ascending (stable on ref for ties).
  txs.sort((a, b) => {
    const t = a.date.getTime() - b.date.getTime();
    if (t !== 0) return t;
    return a.ref.localeCompare(b.ref);
  });

  // Opening balance = sum of all (debit - credit) for transactions BEFORE
  // `from`. If `from` is null, opening balance is 0.
  let openingBalance = 0;
  const inPeriod: TxRow[] = [];
  for (const t of txs) {
    if (fromDate && t.date < fromDate) {
      openingBalance += t.debit - t.credit;
    } else {
      inPeriod.push(t);
    }
  }

  // Apply `to` filter (inclusive upper bound).
  const filtered = toDate
    ? inPeriod.filter((t) => t.date <= toDate)
    : inPeriod;

  // Compute running balance on the period transactions.
  let running = openingBalance;
  const out = filtered.map((t) => {
    running += t.debit - t.credit;
    return {
      date: t.date.toISOString(),
      type: t.type,
      ref: t.ref,
      description: t.description,
      debit: t.debit,
      credit: t.credit,
      balance: running,
    };
  });

  const closingBalance = running;
  const totalInvoiced = filtered.reduce((s, t) => s + t.debit, 0);
  const totalPaid = filtered.reduce((s, t) => s + t.credit, 0);
  const outstanding = closingBalance;

  const body: StatementResponse = {
    party,
    partyType,
    period: {
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
    },
    openingBalance,
    closingBalance,
    transactions: out,
    summary: {
      totalInvoiced,
      totalPaid,
      outstanding,
      txCount: out.length,
    },
  };

  return NextResponse.json(body);
}
