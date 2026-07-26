import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─── Helpers ─────────────────────────────────────────────────────────────

function recomputePaymentStatus(paid: number, total: number): "PAID" | "PARTIAL" | "UNPAID" {
  if (paid >= total && total > 0) return "PAID";
  if (paid <= 0) return "UNPAID";
  return "PARTIAL";
}

// GET /api/payments/:id — fetch a single payment with resolved party + linked invoice/PO.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  // Resolve party + linked invoice/PO in parallel.
  const [customer, supplier, sale, purchase] = await Promise.all([
    payment.partyType === "CUSTOMER"
      ? db.customer.findUnique({ where: { id: payment.partyId }, select: { id: true, name: true, phone: true } })
      : Promise.resolve(null),
    payment.partyType === "SUPPLIER"
      ? db.supplier.findUnique({ where: { id: payment.partyId }, select: { id: true, name: true, company: true } })
      : Promise.resolve(null),
    payment.saleId
      ? db.sale.findUnique({ where: { id: payment.saleId }, select: { id: true, invoiceNo: true, total: true, paid: true, paymentStatus: true } })
      : Promise.resolve(null),
    payment.purchaseId
      ? db.purchase.findUnique({ where: { id: payment.purchaseId }, select: { id: true, poNo: true, total: true, paid: true, paymentStatus: true } })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ...payment,
    partyName: customer?.name ?? supplier?.name ?? "Unknown",
    partySub: customer?.phone ?? supplier?.company ?? null,
    sale: sale ? { id: sale.id, invoiceNo: sale.invoiceNo, total: sale.total, paid: sale.paid, paymentStatus: sale.paymentStatus } : null,
    purchase: purchase ? { id: purchase.id, poNo: purchase.poNo, total: purchase.total, paid: purchase.paid, paymentStatus: purchase.paymentStatus } : null,
  });
}

// DELETE /api/payments/:id — reverse the effect of a payment.
// Decrements sale.paid (or purchase.paid), recomputes paymentStatus,
// and increments the customer/supplier `balance` field, then removes the Payment row.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  await db.$transaction(async (tx) => {
    // 1) Reverse linked sale (decrement paid, recompute status).
    if (payment.saleId) {
      const sale = await tx.sale.findUnique({ where: { id: payment.saleId }, select: { id: true, total: true, paid: true } });
      if (sale) {
        const newPaid = Math.max(0, +(sale.paid - payment.amount).toFixed(2));
        const status = recomputePaymentStatus(newPaid, sale.total);
        await tx.sale.update({
          where: { id: sale.id },
          data: { paid: newPaid, paymentStatus: status },
        });
      }
    }

    // 2) Reverse linked purchase (decrement paid, recompute status).
    if (payment.purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: payment.purchaseId }, select: { id: true, total: true, paid: true } });
      if (purchase) {
        const newPaid = Math.max(0, +(purchase.paid - payment.amount).toFixed(2));
        const status = recomputePaymentStatus(newPaid, purchase.total);
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { paid: newPaid, paymentStatus: status },
        });
      }
    }

    // 3) Increment the party's outstanding balance field (reverse the decrement).
    if (payment.partyType === "CUSTOMER") {
      await tx.customer.update({
        where: { id: payment.partyId },
        data: { balance: { increment: payment.amount } },
      });
    } else {
      await tx.supplier.update({
        where: { id: payment.partyId },
        data: { balance: { increment: payment.amount } },
      });
    }

    // 4) Delete the payment record.
    await tx.payment.delete({ where: { id: payment.id } });
  });

  return new NextResponse(null, { status: 204 });
}
