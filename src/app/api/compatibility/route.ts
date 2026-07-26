import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/compatibility?q=A12  -> search models and return their compatible peers + products
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  if (!q || q.length < 1) {
    return NextResponse.json({ models: [], peers: [], products: [] });
  }

  const models = await db.phoneModel.findMany({
    where: { name: { contains: q } },
    include: { brand: true },
    take: 10,
  });

  if (models.length === 0) {
    return NextResponse.json({ models: [], peers: [], products: [] });
  }

  const modelIds = models.map((m) => m.id);

  // compatibility peers (bidirectional)
  const [asModel, asPeer] = await Promise.all([
    db.modelCompatibility.findMany({
      where: { modelId: { in: modelIds } },
      include: { peer: { include: { brand: true } } },
    }),
    db.modelCompatibility.findMany({
      where: { peerId: { in: modelIds } },
      include: { model: { include: { brand: true } } },
    }),
  ]);

  const peerMap = new Map<string, { id: string; name: string; brand?: string; partType: string; linkId: string }>();
  for (const c of asModel) {
    peerMap.set(c.peer.id + c.partType, { id: c.peer.id, name: c.peer.name, brand: c.peer.brand?.name, partType: c.partType, linkId: c.id });
  }
  for (const c of asPeer) {
    peerMap.set(c.model.id + c.partType, { id: c.model.id, name: c.model.name, brand: c.model.brand?.name, partType: c.partType, linkId: c.id });
  }

  // all related model ids (originals + peers)
  const allModelIds = Array.from(new Set([...modelIds, ...Array.from(peerMap.values()).map((p) => p.id)]));

  // products for these models, grouped by partType
  const products = await db.product.findMany({
    where: { modelId: { in: allModelIds }, active: true },
    include: { brand: true, model: true, partType: true, supplier: true, warehouse: true, shelf: true, images: { take: 1 } },
    orderBy: { partType: { name: "asc" } },
    take: 200,
  });

  return NextResponse.json({ models, peers: Array.from(peerMap.values()), products });
}

// POST /api/compatibility - add compatibility link
export async function POST(req: NextRequest) {
  const { modelId, peerId, partType, note } = await req.json();
  if (!modelId || !peerId) return NextResponse.json({ error: "modelId and peerId required" }, { status: 400 });
  if (modelId === peerId) return NextResponse.json({ error: "Cannot link a model to itself" }, { status: 400 });
  try {
    const compat = await db.modelCompatibility.create({
      data: { modelId, peerId, partType: partType || "", note: note || null },
    });
    return NextResponse.json(compat, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Compatibility link already exists" }, { status: 409 });
  }
}

// DELETE /api/compatibility?id=...
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.modelCompatibility.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
