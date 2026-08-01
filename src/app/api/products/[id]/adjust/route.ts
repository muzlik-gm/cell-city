import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

// Allowed adjustment types and reasons.
const ADJUST_TYPES = new Set(["IN", "OUT", "ADJUST"]);
const REASONS = new Set([
  "RESTOCK",
  "FOUND",
  "LOST",
  "DAMAGED",
  "COUNT_CORRECTION",
  "RETURNED",
  "SAMPLE",
  "OTHER",
]);

// POST /api/products/[id]/adjust
// Body: {
//   type: "IN" | "OUT" | "ADJUST",
//   qty: number,                // delta for IN/OUT, absolute new value for ADJUST
//   reason: string,             // RESTOCK | FOUND | LOST | DAMAGED | COUNT_CORRECTION | RETURNED | SAMPLE | OTHER
//   note?: string,
//   newPurchasePrice?: number,  // only used for IN (restock)
//   newSellingPrice?: number,   // only used for IN (restock)
//   userId?: string,
// }
//
// Behaviour:
//  - IN      → stock += qty, movement type=IN, optional price update + PriceHistory
//  - OUT     → stock -= qty (validated not below 0), movement type=OUT
//  - ADJUST  → stock := qty (absolute correction), movement type=ADJUST with old→new note
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const {
    type,
    qty,
    reason,
    note,
    newPurchasePrice,
    newSellingPrice,
    userId,
  } = body as {
    type?: string;
    qty?: number;
    reason?: string;
    note?: string;
    newPurchasePrice?: number;
    newSellingPrice?: number;
    userId?: string;
  };

  // ── Validate body ──────────────────────────────────────────────────────
  if (!type || !ADJUST_TYPES.has(type)) {
    return NextResponse.json(
      { error: "type must be one of IN, OUT, ADJUST" },
      { status: 400 },
    );
  }
  if (!reason || !REASONS.has(reason)) {
    return NextResponse.json(
      { error: "reason is required and must be a valid value" },
      { status: 400 },
    );
  }

  const qtyN = Number(qty);
  if (!Number.isFinite(qtyN) || qtyN < 0) {
    return NextResponse.json(
      { error: "qty must be a non-negative number" },
      { status: 400 },
    );
  }
  // IN/OUT require a positive delta; ADJUST may set to 0.
  if ((type === "IN" || type === "OUT") && qtyN <= 0) {
    return NextResponse.json(
      { error: "qty must be greater than 0 for IN / OUT adjustments" },
      { status: 400 },
    );
  }

  const product = await db.product.findUnique({
    where: { id },
    include: { warehouse: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.active) {
    return NextResponse.json(
      { error: "Cannot adjust stock for an inactive product" },
      { status: 400 },
    );
  }

  // ── Resolve user (optional) ────────────────────────────────────────────
  let resolvedUserId = userId ?? null;
  if (!resolvedUserId) {
    const anyUser = await db.employee.findFirst({ orderBy: { createdAt: "asc" } });
    resolvedUserId = anyUser?.id ?? null;
  }

  const oldStock = product.stock;
  const oldPurchase = product.purchasePrice;
  const oldSelling = product.sellingPrice;
  const trimmedNote = typeof note === "string" ? note.trim() : "";

  // Compose a clear audit note that always includes the human reason + free-text note.
  const reasonLabel = reason.replace(/_/g, " ").toLowerCase();
  const baseNote = trimmedNote
    ? `[${reasonLabel}] ${trimmedNote}`
    : `[${reasonLabel}]`;

  // ── Compute new stock + movement record ────────────────────────────────
  let newStock = oldStock;
  let movementQty = Math.floor(qtyN);
  const movementType = type;

  if (type === "IN") {
    newStock = oldStock + movementQty;
  } else if (type === "OUT") {
    if (oldStock - movementQty < 0) {
      return NextResponse.json(
        {
          error: `Insufficient stock. Available: ${oldStock}, requested: ${movementQty}`,
        },
        { status: 400 },
      );
    }
    newStock = oldStock - movementQty;
  } else {
    // ADJUST → absolute count correction
    movementQty = Math.abs(Math.floor(qtyN) - oldStock);
    newStock = Math.floor(qtyN);
  }

  const movementNote =
    type === "ADJUST"
      ? trimmedNote
        ? `[${reasonLabel}] ${oldStock} → ${newStock}. ${trimmedNote}`
        : `[${reasonLabel}] ${oldStock} → ${newStock}`
      : baseNote;

  // ── Optional price update (only valid for IN/restock) ──────────────────
  const wantsPriceUpdate =
    type === "IN" &&
    (newPurchasePrice !== undefined || newSellingPrice !== undefined);

  let finalPurchase = oldPurchase;
  let finalSelling = oldSelling;

  if (wantsPriceUpdate) {
    const np =
      newPurchasePrice !== undefined && newPurchasePrice !== null
        ? Number(newPurchasePrice)
        : oldPurchase;
    const ns =
      newSellingPrice !== undefined && newSellingPrice !== null
        ? Number(newSellingPrice)
        : oldSelling;
    if (!Number.isFinite(np) || np < 0) {
      return NextResponse.json(
        { error: "newPurchasePrice must be a non-negative number" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(ns) || ns < 0) {
      return NextResponse.json(
        { error: "newSellingPrice must be a non-negative number" },
        { status: 400 },
      );
    }
    finalPurchase = np;
    finalSelling = ns;
  }

  // ── Transaction: product update + movement + (optional) price history ──
  const priceChanged =
    wantsPriceUpdate &&
    (finalPurchase !== oldPurchase || finalSelling !== oldSelling);

  const [updatedProduct, movement] = await db.$transaction([
    db.product.update({
      where: { id },
      data: {
        stock: newStock,
        ...(wantsPriceUpdate
          ? { purchasePrice: finalPurchase, sellingPrice: finalSelling }
          : {}),
      },
      include: {
        brand: true,
        model: true,
        partType: true,
        supplier: true,
        warehouse: true,
        shelf: true,
        images: { orderBy: { order: "asc" } },
      },
    }),
    db.inventoryMovement.create({
      data: {
        productId: id,
        toWarehouseId: type === "IN" ? (product.warehouseId ?? null) : null,
        fromWarehouseId: type === "OUT" ? (product.warehouseId ?? null) : null,
        qty: movementQty,
        type: movementType,
        ref: reason,
        employeeId: resolvedUserId,
        note: movementNote,
      },
      include: { employee: true },
    }),
    ...(priceChanged
      ? [
          db.priceHistory.create({
            data: {
              productId: id,
              supplierId: product.supplierId ?? null,
              purchasePrice: finalPurchase,
              sellingPrice: finalSelling,
              note: `Adjustment ${type} · ${reasonLabel}`,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(
    {
      product: updatedProduct,
      movement,
      previousStock: oldStock,
      newStock,
      stockDelta: newStock - oldStock,
      priceChanged,
      previousPurchasePrice: oldPurchase,
      previousSellingPrice: oldSelling,
      newPurchasePrice: finalPurchase,
      newSellingPrice: finalSelling,
    },
    { status: 201 },
  );
}
