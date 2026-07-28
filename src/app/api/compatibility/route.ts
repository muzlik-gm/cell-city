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

// POST /api/compatibility - add compatibility link (bidirectional)
// Creates both A→B and B→A so the relationship works both ways.
export async function POST(req: NextRequest) {
  const { modelId, peerId, partType, note } = await req.json();
  if (!modelId || !peerId) return NextResponse.json({ error: "modelId and peerId required" }, { status: 400 });
  if (modelId === peerId) return NextResponse.json({ error: "Cannot link a model to itself" }, { status: 400 });

  const pt = partType || "";
  const n = note || null;

  try {
    // Create both directions in a transaction so the relationship is truly bidirectional.
    // If either already exists, upsert silently skips it.
    await db.$transaction([
      db.modelCompatibility.upsert({
        where: { modelId_peerId_partType: { modelId, peerId, partType: pt } },
        update: { note: n },
        create: { modelId, peerId, partType: pt, note: n },
      }),
      db.modelCompatibility.upsert({
        where: { modelId_peerId_partType: { modelId: peerId, peerId: modelId, partType: pt } },
        update: { note: n },
        create: { modelId: peerId, peerId: modelId, partType: pt, note: n },
      }),
    ]);
    return NextResponse.json({ success: true, bidirectional: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create compatibility link" }, { status: 500 });
  }
}

// DELETE /api/compatibility?id=...  OR  ?modelId=&peerId=&partType=
// Removes the link in both directions.
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const modelId = searchParams.get("modelId");
  const peerId = searchParams.get("peerId");
  const partType = searchParams.get("partType") ?? "";

  if (id) {
    // Delete by id, then also delete the reverse link.
    const link = await db.modelCompatibility.findUnique({ where: { id } }).catch(() => null);
    await db.modelCompatibility.deleteMany({
      where: {
        OR: [
          { id },
          ...(link ? [{ modelId: link.peerId, peerId: link.modelId, partType: link.partType }] : []),
        ],
      },
    });
    return NextResponse.json({ success: true });
  }

  if (modelId && peerId) {
    // Delete both directions by model pair + partType.
    await db.modelCompatibility.deleteMany({
      where: {
        OR: [
          { modelId, peerId, partType },
          { modelId: peerId, peerId: modelId, partType },
        ],
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id or (modelId + peerId) required" }, { status: 400 });
}
