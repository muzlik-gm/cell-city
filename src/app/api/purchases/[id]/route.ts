import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// GET /api/purchases/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      user: true,
      items: { include: { product: { include: { brand: true, model: true, partType: true } } } },
    },
  });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  return NextResponse.json(purchase);
}

// PUT /api/purchases/[id] — update status / payment / notes.
// On CANCELLED status: reverse stock if previously RECEIVED.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const existing = await db.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  const wasCancelled = existing.status === "CANCELLED";
  const willCancel = body.status === "CANCELLED";

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.paymentStatus) data.paymentStatus = body.paymentStatus;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.paid !== undefined) data.paid = Number(body.paid) || 0;

  const updated = await db.purchase.update({ where: { id }, data, include: { items: true, supplier: true } });

  // Reverse stock on cancellation
  if (willCancel && !wasCancelled && existing.status === "RECEIVED") {
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
        type: "OUT",
        ref: existing.poNo,
        note: `Cancelled purchase ${existing.poNo} — reverse`,
      })),
    });
  }

  // Re-add stock if reverting from CANCELLED back to RECEIVED
  if (!willCancel && wasCancelled && body.status === "RECEIVED") {
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
        qty: it.qty,
        type: "PURCHASE",
        ref: existing.poNo,
        note: `Re-applied purchase ${existing.poNo}`,
      })),
    });
  }

  return NextResponse.json(updated);
}

// DELETE /api/purchases/[id] — reverse stock if RECEIVED, then delete.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const purchase = await db.purchase.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  if (purchase.status === "RECEIVED") {
    await Promise.all(
      purchase.items.map((it) =>
        db.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        })
      )
    );
    await db.inventoryMovement.createMany({
      data: purchase.items.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        type: "OUT",
        ref: purchase.poNo,
        note: `Deleted purchase ${purchase.poNo} — reverse`,
      })),
    });
  }

  await db.purchase.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
