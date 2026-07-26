import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// GET /api/repairs/[id] — full repair with customer, model+brand, technician, parts.product.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const repair = await db.repairJob.findUnique({
    where: { id },
    include: {
      customer: true,
      model: { include: { brand: true } },
      technician: true,
      parts: { include: { product: { include: { brand: true, model: true, partType: true } } } },
    },
  });
  if (!repair) return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  return NextResponse.json(repair);
}

// PATCH /api/repairs/[id] — update fields.
// Status transitions set timestamps:
//   →COMPLETED sets completedAt (only if not already set)
//   →DELIVERED sets deliveredAt (only if not already set)
//   →CANCELLED/RECEIVED clears those timestamps
// Also allows updating diagnosis, technicianId, laborCost, partsCost, paymentStatus, paid, notes, imageUrl.
// Recomputes total = laborCost + partsCost on every cost change.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const existing = await db.repairJob.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.diagnosis !== undefined) data.diagnosis = body.diagnosis?.trim() || null;
  if (body.technicianId !== undefined) data.technicianId = body.technicianId || null;
  if (body.laborCost !== undefined) data.laborCost = Math.max(0, Number(body.laborCost) || 0);
  if (body.partsCost !== undefined) data.partsCost = Math.max(0, Number(body.partsCost) || 0);
  if (body.paymentStatus !== undefined) data.paymentStatus = body.paymentStatus;
  if (body.paid !== undefined) data.paid = Math.max(0, Number(body.paid) || 0);
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null;
  if (body.imei !== undefined) data.imei = body.imei?.trim() || null;
  if (body.problem !== undefined) data.problem = String(body.problem).trim();
  if (body.modelId !== undefined) data.modelId = body.modelId || null;
  if (body.customerId !== undefined) data.customerId = body.customerId || null;

  // Status-driven timestamps
  if (body.status !== undefined) {
    if (body.status === "COMPLETED" && !existing.completedAt) {
      data.completedAt = new Date();
    }
    if (body.status === "DELIVERED" && !existing.deliveredAt) {
      data.deliveredAt = new Date();
    }
    // Revert timestamps if going backwards
    if (body.status === "RECEIVED" || body.status === "CANCELLED") {
      data.completedAt = null;
      data.deliveredAt = null;
    }
    if (body.status === "DIAGNOSED" || body.status === "WAITING_PARTS" || body.status === "REPAIRING") {
      // keep completedAt/deliveredAt intact unless explicitly regressing before completion
    }
  }

  // Recompute total from (possibly new) labor + parts costs.
  const laborCost = data.laborCost !== undefined ? Number(data.laborCost) : existing.laborCost;
  const partsCost = data.partsCost !== undefined ? Number(data.partsCost) : existing.partsCost;
  data.total = laborCost + partsCost;

  // If status→DELIVERED and paymentStatus is UNPAID, leave it (manual). If marking paid fully,
  // caller can pass paymentStatus=PAID + paid=total.
  if (body.paymentStatus === "PAID" && body.paid === undefined) {
    data.paid = data.total as number;
  }

  const updated = await db.repairJob.update({
    where: { id },
    data,
    include: {
      customer: true,
      model: { include: { brand: true } },
      technician: true,
      parts: { include: { product: { include: { brand: true, model: true } } } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/repairs/[id] — hard delete (cascades RepairJobPart).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.repairJob.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

  await db.repairJob.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
