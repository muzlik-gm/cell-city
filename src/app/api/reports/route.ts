import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";

// GET /api/reports?type=<inventory|sales|profit|supplier|customer|repair|purchase|lowstock|damaged>[&format=csv][&from=ISO][&to=ISO]
//
// Each report returns rows. If format=csv, returns text/csv with Content-Disposition.
type ReportType =
  | "inventory"
  | "sales"
  | "profit"
  | "supplier"
  | "customer"
  | "repair"
  | "purchase"
  | "lowstock"
  | "damaged";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function parseDateRange(from: string | null, to: string | null) {
  const fromD = from ? new Date(from) : null;
  const toD = to ? new Date(to) : null;
  if (toD) toD.setHours(23, 59, 59, 999);
  return { fromD, toD };
}

// ── Inventory report ─────────────────────────────────────────────────────
async function inventoryReport() {
  const products = await db.product.findMany({
    where: { active: true },
    include: { brand: true, model: true, partType: true, warehouse: true, shelf: true, supplier: true },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    SKU: p.sku,
    Name: p.name,
    Brand: p.brand?.name ?? "",
    Model: p.model?.name ?? "",
    PartType: p.partType?.name ?? "",
    Category: p.partType?.category ?? "",
    Quality: p.quality,
    Condition: p.condition,
    Stock: p.stock,
    MinStock: p.minStock,
    PurchasePrice: p.purchasePrice,
    SellingPrice: p.sellingPrice,
    InventoryValue: p.purchasePrice * p.stock,
    RetailValue: p.sellingPrice * p.stock,
    PotentialProfit: (p.sellingPrice - p.purchasePrice) * p.stock,
    Warehouse: p.warehouse?.code ?? "",
    Shelf: p.shelf?.code ?? "",
    Supplier: p.supplier?.name ?? "",
  }));
}

// ── Sales report ─────────────────────────────────────────────────────────
async function salesReport(from: string | null, to: string | null) {
  const { fromD, toD } = parseDateRange(from, to);
  const sales = await db.sale.findMany({
    where: {
      ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lte: toD } : {}) } } : {}),
    },
    include: { customer: true, employee: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  return sales.map((s) => ({
    InvoiceNo: s.invoiceNo,
    Date: s.createdAt.toISOString().slice(0, 10),
    Customer: s.customer?.name ?? "Walk-in",
    CustomerPhone: s.customer?.phone ?? "",
    Items: s.items.length,
    Subtotal: s.subtotal,
    Discount: s.discount,
    Tax: s.tax,
    Total: s.total,
    Paid: s.paid,
    Profit: s.profit,
    PaymentMethod: s.paymentMethod,
    PaymentStatus: s.paymentStatus,
    Status: s.status,
    Salesperson: s.user?.name ?? "",
  }));
}

// ── Profit report ────────────────────────────────────────────────────────
async function profitReport(from: string | null, to: string | null) {
  const { fromD, toD } = parseDateRange(from, to);
  const sales = await db.sale.findMany({
    where: {
      status: "COMPLETED",
      ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lte: toD } : {}) } } : {}),
    },
    include: { items: { include: { product: { include: { brand: true } } } }, customer: true },
    orderBy: { createdAt: "desc" },
  });
  const rows: Record<string, unknown>[] = [];
  for (const s of sales) {
    for (const it of s.items) {
      rows.push({
        InvoiceNo: s.invoiceNo,
        Date: s.createdAt.toISOString().slice(0, 10),
        Customer: s.customer?.name ?? "Walk-in",
        Product: it.name,
        Brand: it.product?.brand?.name ?? "",
        Qty: it.qty,
        Price: it.price,
        Cost: it.cost,
        Revenue: it.total,
        Profit: it.total - it.cost * it.qty,
        MarginPct: it.total > 0 ? Number((((it.total - it.cost * it.qty) / it.total) * 100).toFixed(2)) : 0,
      });
    }
  }
  return rows;
}

// ── Supplier report ──────────────────────────────────────────────────────
async function supplierReport() {
  const suppliers = await db.supplier.findMany({
    where: { active: true },
    include: { _count: { select: { purchases: true, products: true } } },
  });
  const purchases = await db.purchase.findMany({
    where: { supplierId: { in: suppliers.map((s) => s.id) } },
    select: { supplierId: true, total: true, paid: true, status: true, paymentStatus: true },
  });
  return suppliers.map((s) => {
    const sp = purchases.filter((p) => p.supplierId === s.id);
    const totalSpent = sp.reduce((sum, p) => sum + p.total, 0);
    const outstanding = sp.filter((p) => p.paymentStatus !== "PAID").reduce((sum, p) => sum + (p.total - p.paid), 0);
    const received = sp.filter((p) => p.status === "RECEIVED").length;
    return {
      Name: s.name,
      Company: s.company ?? "",
      ContactPerson: s.contactPerson ?? "",
      Phone: s.phone ?? "",
      WhatsApp: s.whatsapp ?? "",
      Email: s.email ?? "",
      Address: s.address ?? "",
      Rating: s.rating,
      Purchases: sp.length,
      Received: received,
      ProductsSupplied: s._count.products,
      TotalSpent: totalSpent,
      Outstanding: outstanding,
    };
  });
}

// ── Customer report ──────────────────────────────────────────────────────
async function customerReport() {
  const customers = await db.customer.findMany({
    where: { active: true },
    include: { _count: { select: { sales: true, repairJobs: true } } },
  });
  const sales = await db.sale.findMany({
    where: { customerId: { in: customers.map((c) => c.id) } },
    select: { customerId: true, total: true, paid: true, paymentStatus: true },
  });
  return customers.map((c) => {
    const cs = sales.filter((s) => s.customerId === c.id);
    const spent = cs.reduce((sum, s) => sum + s.total, 0);
    const outstanding = cs.filter((s) => s.paymentStatus !== "PAID").reduce((sum, s) => sum + (s.total - s.paid), 0);
    return {
      Name: c.name,
      Company: c.company ?? "",
      Phone: c.phone ?? "",
      WhatsApp: c.whatsapp ?? "",
      Email: c.email ?? "",
      Address: c.address ?? "",
      Sales: c._count.sales,
      Repairs: c._count.repairJobs,
      TotalSpent: spent,
      Outstanding: outstanding,
    };
  });
}

// ── Repair report ────────────────────────────────────────────────────────
async function repairReport(from: string | null, to: string | null) {
  const { fromD, toD } = parseDateRange(from, to);
  const repairs = await db.repairJob.findMany({
    where: {
      ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lte: toD } : {}) } } : {}),
    },
    include: { customer: true, model: { include: { brand: true } }, technician: true, parts: true },
    orderBy: { createdAt: "desc" },
  });
  return repairs.map((r) => ({
    TicketNo: r.ticketNo,
    ReceivedAt: r.receivedAt.toISOString().slice(0, 10),
    Customer: r.customer?.name ?? "Walk-in",
    Brand: r.model?.brand?.name ?? "",
    Model: r.model?.name ?? "",
    IMEI: r.imei ?? "",
    Problem: r.problem,
    Diagnosis: r.diagnosis ?? "",
    Technician: r.technician?.name ?? "",
    Status: r.status,
    PaymentStatus: r.paymentStatus,
    LaborCost: r.laborCost,
    PartsCost: r.partsCost,
    Total: r.total,
    Paid: r.paid,
    CompletedAt: r.completedAt?.toISOString().slice(0, 10) ?? "",
    DeliveredAt: r.deliveredAt?.toISOString().slice(0, 10) ?? "",
  }));
}

// ── Purchase report ──────────────────────────────────────────────────────
async function purchaseReport(from: string | null, to: string | null) {
  const { fromD, toD } = parseDateRange(from, to);
  const purchases = await db.purchase.findMany({
    where: {
      ...(fromD || toD ? { createdAt: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lte: toD } : {}) } } : {}),
    },
    include: { supplier: true, employee: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  return purchases.map((p) => ({
    PoNo: p.poNo,
    Date: p.createdAt.toISOString().slice(0, 10),
    Supplier: p.supplier?.name ?? "",
    Items: p.items.length,
    Subtotal: p.subtotal,
    Discount: p.discount,
    Tax: p.tax,
    Total: p.total,
    Paid: p.paid,
    PaymentStatus: p.paymentStatus,
    Status: p.status,
    Buyer: p.user?.name ?? "",
  }));
}

// ── Low stock report ─────────────────────────────────────────────────────
async function lowStockReport() {
  const products = await db.product.findMany({
    where: { active: true, stock: { lte: 5 } },
    include: { brand: true, model: true, partType: true, warehouse: true, shelf: true, supplier: true },
    orderBy: { stock: "asc" },
  });
  return products.map((p) => ({
    SKU: p.sku,
    Name: p.name,
    Brand: p.brand?.name ?? "",
    Model: p.model?.name ?? "",
    PartType: p.partType?.name ?? "",
    Stock: p.stock,
    MinStock: p.minStock,
    Deficit: Math.max(0, p.minStock - p.stock),
    PurchasePrice: p.purchasePrice,
    SellingPrice: p.sellingPrice,
    Warehouse: p.warehouse?.code ?? "",
    Shelf: p.shelf?.code ?? "",
    Supplier: p.supplier?.name ?? "",
  }));
}

// ── Damaged report ───────────────────────────────────────────────────────
async function damagedReport(from: string | null, to: string | null) {
  const { fromD, toD } = parseDateRange(from, to);
  const damages = await db.damagedInventory.findMany({
    where: {
      ...(fromD || toD ? { date: { ...(fromD ? { gte: fromD } : {}), ...(toD ? { lte: toD } : {}) } } : {}),
    },
    include: { product: { include: { brand: true, model: true, partType: true, warehouse: true } } },
    orderBy: { date: "desc" },
  });
  return damages.map((d) => ({
    Date: d.date.toISOString().slice(0, 10),
    SKU: d.product?.sku ?? "",
    Product: d.product?.name ?? "",
    Brand: d.product?.brand?.name ?? "",
    Model: d.product?.model?.name ?? "",
    PartType: d.product?.partType?.name ?? "",
    Qty: d.qty,
    Reason: d.reason,
    ValueLost: d.qty * (d.product?.purchasePrice ?? 0),
    Warehouse: d.product?.warehouse?.code ?? "",
    Note: d.note ?? "",
  }));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "") as ReportType;
  const format = searchParams.get("format");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const validTypes: ReportType[] = [
    "inventory", "sales", "profit", "supplier", "customer",
    "repair", "purchase", "lowstock", "damaged",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid report type. Valid types: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  let rows: Record<string, unknown>[];
  switch (type) {
    case "inventory": rows = await inventoryReport(); break;
    case "sales": rows = await salesReport(from, to); break;
    case "profit": rows = await profitReport(from, to); break;
    case "supplier": rows = await supplierReport(); break;
    case "customer": rows = await customerReport(); break;
    case "repair": rows = await repairReport(from, to); break;
    case "purchase": rows = await purchaseReport(from, to); break;
    case "lowstock": rows = await lowStockReport(); break;
    case "damaged": rows = await damagedReport(from, to); break;
  }

  if (format === "csv") {
    const csv = toCSV(rows);
    const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ type, rows, count: rows.length });
}
