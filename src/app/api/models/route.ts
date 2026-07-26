import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/models?brandId=...&q=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brandId");
  const q = searchParams.get("q");

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
