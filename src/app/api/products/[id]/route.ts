import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    include: {
      brand: true, model: true, partType: true, supplier: true,
      warehouse: true, shelf: true, images: { orderBy: { order: "asc" } },
      priceHistory: { include: { supplier: true }, orderBy: { date: "desc" }, take: 20 },
      movements: { include: { employee: true }, orderBy: { date: "desc" }, take: 15 },
    },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { images, ...rest } = body;

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Track price changes
  const newPurchase = body.purchasePrice != null ? Number(body.purchasePrice) : existing.purchasePrice;
  const newSelling = body.sellingPrice != null ? Number(body.sellingPrice) : existing.sellingPrice;
  if (newPurchase !== existing.purchasePrice || newSelling !== existing.sellingPrice) {
    await db.priceHistory.create({
      data: {
        productId: id,
        supplierId: body.supplierId ?? existing.supplierId,
        purchasePrice: newPurchase,
        sellingPrice: newSelling,
        note: "Price update",
      },
    });
  }

  // Track stock adjustments
  const newStock = body.stock != null ? Number(body.stock) : existing.stock;
  if (newStock !== existing.stock) {
    const diff = newStock - existing.stock;
    await db.inventoryMovement.create({
      data: {
        productId: id,
        toWarehouseId: body.warehouseId ?? existing.warehouseId,
        qty: Math.abs(diff),
        type: diff > 0 ? "IN" : "OUT",
        note: body.stockNote ?? "Manual adjustment",
      },
    });
  }

  // Sync images
  if (images !== undefined) {
    await db.productImage.deleteMany({ where: { productId: id } });
    if (Array.isArray(images) && images.length) {
      await db.productImage.createMany({
        data: images.map((img: { url: string; kind?: string }, i: number) => ({
          productId: id, url: img.url, kind: img.kind ?? "FRONT", order: i,
        })),
      });
    }
  }

  const updated = await db.product.update({
    where: { id },
    data: {
      ...rest,
      purchasePrice: rest.purchasePrice != null ? Number(rest.purchasePrice) : undefined,
      sellingPrice: rest.sellingPrice != null ? Number(rest.sellingPrice) : undefined,
      stock: rest.stock != null ? Number(rest.stock) : undefined,
      minStock: rest.minStock != null ? Number(rest.minStock) : undefined,
    },
    include: { brand: true, model: true, partType: true, supplier: true, warehouse: true, shelf: true, images: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  // soft delete
  await db.product.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
