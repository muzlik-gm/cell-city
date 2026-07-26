import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Low stock count for the topbar badge.
export async function GET() {
  const count = await db.product.count({
    where: { active: true, stock: { lte: db.product.fields.minStock } },
  });
  return NextResponse.json({ count });
}
