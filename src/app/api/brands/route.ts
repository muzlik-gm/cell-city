import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const brands = await db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" }, include: { _count: { select: { models: true, products: true } } } });
  return NextResponse.json(brands);
}

export async function POST(req: NextRequest) {
  const { name, country } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const brand = await db.brand.create({ data: { name, slug, country: country || null } });
  return NextResponse.json(brand, { status: 201 });
}
