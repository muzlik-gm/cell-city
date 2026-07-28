import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface Params { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { name, brandId, releaseYear, notes, imageUrl } = await req.json();
  const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined;
  const model = await db.phoneModel.update({
    where: { id },
    data: {
      ...(name ? { name, slug } : {}),
      ...(brandId !== undefined ? { brandId } : {}),
      ...(releaseYear !== undefined ? { releaseYear: releaseYear || null } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    },
  });
  return NextResponse.json(model);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  // Soft delete: set active false. Hard delete would break FK references.
  await db.phoneModel.update({ where: { id }, data: { active: false } }).catch(() => {});
  // Also remove compatibility links
  await db.modelCompatibility.deleteMany({ where: { OR: [{ modelId: id }, { peerId: id }] } }).catch(() => {});
  return NextResponse.json({ success: true });
}
