import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await db.brand.update({ where: { id }, data: { active: false } }).catch(() => {});
  return NextResponse.json({ success: true });
}
