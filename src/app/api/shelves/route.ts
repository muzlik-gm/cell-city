import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get("warehouseId");
  const shelves = await db.shelf.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    include: { warehouse: true, _count: { select: { products: true } } },
    orderBy: { code: "asc" },
  });
  return NextResponse.json(shelves);
}

export async function POST(req: NextRequest) {
  const { code, warehouseId, rack, bin, description } = await req.json();
  if (!code || !warehouseId) return NextResponse.json({ error: "Code and warehouse required" }, { status: 400 });
  const shelf = await db.shelf.create({ data: { code, warehouseId, rack: rack || null, bin: bin || null, description: description || null } });
  return NextResponse.json(shelf, { status: 201 });
}
