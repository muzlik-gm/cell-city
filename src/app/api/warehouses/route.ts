import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const warehouses = await db.warehouse.findMany({
    where: { active: true },
    include: { shelves: { orderBy: { code: "asc" } }, _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(warehouses);
}

export async function POST(req: NextRequest) {
  const { name, code, address } = await req.json();
  if (!name || !code) return NextResponse.json({ error: "Name and code required" }, { status: 400 });
  const wh = await db.warehouse.create({ data: { name, code, address: address || null } });
  return NextResponse.json(wh, { status: 201 });
}
