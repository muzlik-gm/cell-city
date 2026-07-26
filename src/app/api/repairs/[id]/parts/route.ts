import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// POST /api/repairs/[id]/parts — add a part to a repair job.
// Body: { productId, qty, used? }
// - Creates RepairJobPart (cost = product.purchasePrice × qty at time of add).
// - If used=true (default false), deducts stock from product + creates InventoryMovement type=REPAIR.
// - Recomputes partsCost (sum of used parts' cost) on the repair.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { productId, qty, used } = body as { productId?: string; qty?: number; used?: boolean };

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }
  const qtyN = Math.max(1, Math.floor(Number(qty) || 0));
  if (qtyN <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
  }
  const markUsed = Boolean(used);

  const [repair, product] = await Promise.all([
    db.repairJob.findUnique({ where: { id }, include: { parts: true } }),
    db.product.findUnique({ where: { id: productId }, include: { warehouse: true } }),
  ]);
  if (!repair) return NextResponse.json({ error: "Repair not found" }, { status: 404 });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (markUsed && product.stock < qtyN) {
    return NextResponse.json(
      { error: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${qtyN}` },
      { status: 400 }
    );
  }

  const lineCost = product.purchasePrice * qtyN;

  // Create the RepairJobPart
  const part = await db.repairJobPart.create({
    data: {
      repairId: id,
      productId,
      qty: qtyN,
      cost: lineCost,
      used: markUsed,
    },
    include: { product: { include: { brand: true, model: true } } },
  });

  // If marked used immediately, deduct stock + record movement
  if (markUsed) {
    await db.product.update({
      where: { id: productId },
      data: { stock: { decrement: qtyN } },
    });
    await db.inventoryMovement.create({
      data: {
        productId,
        fromWarehouseId: product.warehouseId ?? null,
        qty: qtyN,
        type: "REPAIR",
        ref: repair.ticketNo,
        note: `Used in repair ${repair.ticketNo}`,
      },
    });
  }

  // Recompute partsCost = sum of costs of used parts (including this new one if used).
  // We re-query to be safe with concurrent updates.
  const allParts = await db.repairJobPart.findMany({ where: { repairId: id, used: true } });
  const partsCost = allParts.reduce((s, p) => s + p.cost, 0);
  const updatedRepair = await db.repairJob.update({
    where: { id },
    data: {
      partsCost,
      total: repair.laborCost + partsCost,
    },
  });

  return NextResponse.json({ part, repair: updatedRepair }, { status: 201 });
}

// PATCH /api/repairs/[id]/parts?partId=... — toggle `used` on an existing RepairJobPart.
// Body: { used: boolean }
// When flipping used false→true, deducts stock + creates REPAIR movement.
// When flipping true→false, restocks product + creates IN movement (reversal).
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  const body = await req.json();
  const used = Boolean(body.used);

  if (!partId) return NextResponse.json({ error: "partId query param is required" }, { status: 400 });

  const part = await db.repairJobPart.findUnique({
    where: { id: partId },
    include: { product: { include: { warehouse: true } } },
  });
  if (!part || part.repairId !== id) {
    return NextResponse.json({ error: "Repair part not found" }, { status: 404 });
  }
  if (part.used === used) {
    return NextResponse.json({ part, message: "No change" });
  }

  const repair = await db.repairJob.findUnique({ where: { id } });
  if (!repair) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

  if (used) {
    // Mark used: deduct stock
    if (part.product.stock < part.qty) {
      return NextResponse.json(
        { error: `Insufficient stock for ${part.product.name}. Available: ${part.product.stock}, needed: ${part.qty}` },
        { status: 400 }
      );
    }
    await db.product.update({
      where: { id: part.productId },
      data: { stock: { decrement: part.qty } },
    });
    await db.inventoryMovement.create({
      data: {
        productId: part.productId,
        fromWarehouseId: part.product.warehouseId ?? null,
        qty: part.qty,
        type: "REPAIR",
        ref: repair.ticketNo,
        note: `Used in repair ${repair.ticketNo}`,
      },
    });
  } else {
    // Unmark used: restock
    await db.product.update({
      where: { id: part.productId },
      data: { stock: { increment: part.qty } },
    });
    await db.inventoryMovement.create({
      data: {
        productId: part.productId,
        toWarehouseId: part.product.warehouseId ?? null,
        qty: part.qty,
        type: "IN",
        ref: repair.ticketNo,
        note: `Reversal — unused in repair ${repair.ticketNo}`,
      },
    });
  }

  const updatedPart = await db.repairJobPart.update({
    where: { id: partId },
    data: { used },
    include: { product: { include: { brand: true, model: true } } },
  });

  // Recompute partsCost
  const allParts = await db.repairJobPart.findMany({ where: { repairId: id, used: true } });
  const partsCost = allParts.reduce((s, p) => s + p.cost, 0);
  const updatedRepair = await db.repairJob.update({
    where: { id },
    data: { partsCost, total: repair.laborCost + partsCost },
  });

  return NextResponse.json({ part: updatedPart, repair: updatedRepair });
}

// DELETE /api/repairs/[id]/parts?partId=... — remove a RepairJobPart.
// If the part was marked used, restock + create IN reversal movement first.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const partId = searchParams.get("partId");
  if (!partId) return NextResponse.json({ error: "partId query param is required" }, { status: 400 });

  const part = await db.repairJobPart.findUnique({
    where: { id: partId },
    include: { product: { include: { warehouse: true } } },
  });
  if (!part || part.repairId !== id) {
    return NextResponse.json({ error: "Repair part not found" }, { status: 404 });
  }

  const repair = await db.repairJob.findUnique({ where: { id } });
  if (!repair) return NextResponse.json({ error: "Repair not found" }, { status: 404 });

  if (part.used) {
    await db.product.update({
      where: { id: part.productId },
      data: { stock: { increment: part.qty } },
    });
    await db.inventoryMovement.create({
      data: {
        productId: part.productId,
        toWarehouseId: part.product.warehouseId ?? null,
        qty: part.qty,
        type: "IN",
        ref: repair.ticketNo,
        note: `Removed from repair ${repair.ticketNo}`,
      },
    });
  }

  await db.repairJobPart.delete({ where: { id: partId } });

  // Recompute partsCost
  const allParts = await db.repairJobPart.findMany({ where: { repairId: id, used: true } });
  const partsCost = allParts.reduce((s, p) => s + p.cost, 0);
  const updatedRepair = await db.repairJob.update({
    where: { id },
    data: { partsCost, total: repair.laborCost + partsCost },
  });

  return NextResponse.json({ success: true, repair: updatedRepair });
}
