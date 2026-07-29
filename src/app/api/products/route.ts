import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getBusinessId } from "@/lib/business-context";

// GET /api/products - list with search, filters, pagination (scoped to business)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
  const brandId = searchParams.get("brandId");
  const modelId = searchParams.get("modelId");
  const partTypeId = searchParams.get("partTypeId");
  const supplierId = searchParams.get("supplierId");
  const warehouseId = searchParams.get("warehouseId");
  const quality = searchParams.get("quality");
  const lowStock = searchParams.get("lowStock") === "true";

  const businessId = await getBusinessId();
  const where: Prisma.ProductWhereInput = { active: true, ...(businessId ? { businessId } : {}) };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { sku: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
      { lcdCode: { contains: q, mode: "insensitive" } },
      { connectorType: { contains: q, mode: "insensitive" } },
      { model: { name: { contains: q } } },
      { brand: { name: { contains: q } } },
    ];
  }
  if (brandId) where.brandId = brandId;
  if (modelId) where.modelId = modelId;
  if (partTypeId) where.partTypeId = partTypeId;
  if (supplierId) where.supplierId = supplierId;
  if (warehouseId) where.warehouseId = warehouseId;
  if (quality) where.quality = quality;
  if (lowStock) where.stock = { lte: Prisma.productScalarFieldEnum.minStock ? undefined : 0 };
  if (lowStock) where.stock = { lte: 0 };

  // proper low stock: stock <= minStock. SQLite doesn't support row-level compare in where via prisma easily; filter post.
  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        brand: true,
        model: true,
        partType: true,
        supplier: true,
        warehouse: true,
        shelf: true,
        images: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  let filtered = products;
  if (lowStock) {
    filtered = products.filter((p) => p.stock <= p.minStock);
  }

  return NextResponse.json({ data: filtered, total: lowStock ? filtered.length : total, page, pageSize });
}

// POST /api/products - create
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name, sku, barcode, brandId, modelId, partTypeId, quality, condition, color,
    supplierId, purchasePrice, sellingPrice, stock, minStock, warehouseId, shelfId,
    connectorType, lcdCode, warranty, notes, images,
  } = body;

  if (!name || !sku) {
    return NextResponse.json({ error: "Name and SKU are required" }, { status: 400 });
  }

  const existing = await db.product.findUnique({ where: { sku } });
  if (existing) return NextResponse.json({ error: "SKU already exists" }, { status: 409 });

  const product = await db.product.create({
    data: {
      name, sku,
      barcode: barcode || null,
      qrCode: sku,
      brandId: brandId || null,
      modelId: modelId || null,
      partTypeId: partTypeId || null,
      quality: quality || "ORIGINAL",
      condition: condition || "NEW",
      color: color || null,
      supplierId: supplierId || null,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 5,
      warehouseId: warehouseId || null,
      shelfId: shelfId || null,
      connectorType: connectorType || null,
      lcdCode: lcdCode || null,
      warranty: warranty || null,
      notes: notes || null,
      images: images?.length
        ? { create: images.map((img: { url: string; kind?: string }, i: number) => ({ url: img.url, kind: img.kind ?? "FRONT", order: i })) }
        : undefined,
    },
    include: { brand: true, model: true, partType: true, supplier: true, warehouse: true, shelf: true, images: true },
  });

  if (Number(stock) > 0) {
    await db.priceHistory.create({
      data: {
        productId: product.id,
        supplierId: supplierId || null,
        purchasePrice: Number(purchasePrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        note: "Initial stock",
      },
    });
    await db.inventoryMovement.create({
      data: {
        productId: product.id,
        toWarehouseId: warehouseId || null,
        qty: Number(stock),
        type: "IN",
        ref: "INITIAL",
        note: "Initial stock",
      },
    });
  }

  return NextResponse.json(product, { status: 201 });
}
