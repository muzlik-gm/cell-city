import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/models?brandId=...&q=...&popular=true
// When popular=true, returns models sorted by sales volume (sum of SaleItem qty).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const q = searchParams.get("q");
  const popular = searchParams.get("popular") === "true";

  if (popular) {
    // Aggregate sales volume per model via SaleItem → Product → modelId
    const items = await db.saleItem.findMany({
      where: { product: { modelId: { not: null } } },
      select: { qty: true, product: { select: { modelId: true } } },
    });
    const volumeMap = new Map<string, number>();
    for (const it of items) {
      const mid = it.product.modelId;
      if (!mid) continue;
      volumeMap.set(mid, (volumeMap.get(mid) ?? 0) + it.qty);
    }
    // Also include models with stock (so popular-by-availability shows too)
    const allModels = await db.phoneModel.findMany({
      where: { active: true },
      include: { brand: true, _count: { select: { products: true } } },
      take: 100,
    });
    const ranked = allModels
      .map((m) => ({ ...m, salesVolume: volumeMap.get(m.id) ?? 0 }))
      .sort((a, b) => b.salesVolume - a.salesVolume || a.name.localeCompare(b.name))
      .slice(0, 8);
    return NextResponse.json(ranked);
  }

  const models = await db.phoneModel.findMany({
    where: {
      active: true,
      ...(brandId ? { brandId } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }] } : {}),
    },
    include: { brand: true, _count: { select: { products: true, compatAsModel: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });
  return NextResponse.json(models);
}

export async function POST(req: NextRequest) {
  const { name, brandId, releaseYear, notes } = await req.json();
  if (!name || !brandId) return NextResponse.json({ error: "Name and brand required" }, { status: 400 });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const model = await db.phoneModel.create({ data: { name, slug, brandId, releaseYear: releaseYear || null, notes: notes || null } });
  return NextResponse.json(model, { status: 201 });
}
