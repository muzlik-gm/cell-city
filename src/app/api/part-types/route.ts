import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const types = await db.partType.findMany({ where: { active: true }, orderBy: { category: "asc" } });
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const { name, category } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pt = await db.partType.create({ data: { name, slug, category: category || "Misc" } });
  return NextResponse.json(pt, { status: 201 });
}
