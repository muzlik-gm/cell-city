import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// Load business settings (used in invoice rendering).
async function getBusinessInfo() {
  const rows = await db.setting.findMany({
    where: {
      key: {
        in: [
          "business_name", "business_phone", "business_address", "business_email",
          "currency_symbol", "tax_name",
        ],
      },
    },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    name: map.business_name ?? "Cell City",
    phone: map.business_phone ?? "",
    address: map.business_address ?? "",
    email: map.business_email ?? "",
    currencySymbol: map.currency_symbol ?? "Rs",
    taxName: map.tax_name ?? "Tax",
  };
}

// GET /api/sales/[id] — full sale with items, product, customer, business info.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      user: true,
      items: { include: { product: { include: { brand: true, model: true, partType: true } } } },
    },
  });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  const business = await getBusinessInfo();
  return NextResponse.json({ ...sale, business });
}

// PUT /api/sales/[id] — update sale status / payment status / notes.
// On RETURNED status: restock items and reverse inventory movements (only if not already returned).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const existing = await db.sale.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  const wasReturned = existing.status === "RETURNED";
  const willReturn = body.status === "RETURNED";

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.paymentStatus) data.paymentStatus = body.paymentStatus;
  if (body.paymentMethod) data.paymentMethod = body.paymentMethod;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.paid !== undefined) data.paid = Number(body.paid) || 0;

  const updated = await db.sale.update({ where: { id }, data, include: { items: true, customer: true } });

  // Handle restock on RETURNED transition (only once)
  if (willReturn && !wasReturned) {
    await Promise.all(
      existing.items.map((it) =>
        db.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.qty } },
        })
      )
    );
    await db.inventoryMovement.createMany({
      data: existing.items.map((it) => ({
        productId: it.productId,
        toWarehouseId: null,
        qty: it.qty,
        type: "IN",
        ref: existing.invoiceNo,
        note: `Return restock — ${existing.invoiceNo}`,
      })),
    });
  }

  // If un-returning (back to COMPLETED), re-deduct stock
  if (!willReturn && wasReturned && body.status === "COMPLETED") {
    await Promise.all(
      existing.items.map((it) =>
        db.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        })
      )
    );
    await db.inventoryMovement.createMany({
      data: existing.items.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        type: "SALE",
        ref: existing.invoiceNo,
        note: `Re-applied sale ${existing.invoiceNo}`,
      })),
    });
  }

  return NextResponse.json(updated);
}

// DELETE /api/sales/[id] — delete sale. Restock items first if not returned.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sale = await db.sale.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  // Restock if currently completed (not returned)
  if (sale.status !== "RETURNED") {
    await Promise.all(
      sale.items.map((it) =>
        db.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.qty } },
        })
      )
    );
    await db.inventoryMovement.createMany({
      data: sale.items.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        type: "IN",
        ref: sale.invoiceNo,
        note: `Deleted sale ${sale.invoiceNo} — restock`,
      })),
    });
  }

  await db.sale.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
