import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";

// GET /api/compatibility-search?q=<phone model or brand>
// Compatibility-first search: returns phone models matching the query,
// then for each matched model (and its compatible peers), groups all available
// products by part type, aggregating stock by quality.
//
// Response shape:
// {
//   query, matchedModels: [{ id, name, brand }], compatibleModels: [{ id, name, brand, partType }],
//   partGroups: [
//     {
//       partType: "LCD",
//       fitsModels: ["Samsung A12", "Samsung M12", "Samsung F12"],
//       qualities: [
//         { quality: "ORIGINAL", totalStock: 12, products: [{...}], shelves: ["B-14"] },
//         { quality: "OEM", totalStock: 6, products: [{...}] },
//         { quality: "COPY", totalStock: 20, products: [{...}] },
//       ],
//       bestPrice: 1800,
//       image: "url"
//     },
//     { partType: "Touch Glass", ... },
//   ]
// }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ query: q, matchedModels: [], compatibleModels: [], partGroups: [] });
  }

  // 1. Find phone models matching the query (scoped to business)
  const businessId = await getBusinessId();
  const bizFilter = businessId ? { businessId } : {};
  const matchedModels = await db.phoneModel.findMany({
    where: {
      ...bizFilter,
      OR: [
        { name: { contains: q } },
        { slug: { contains: q } },
        { brand: { name: { contains: q } } },
      ],
    },
    include: { brand: true },
    take: 10,
  });

  if (matchedModels.length === 0) {
    return NextResponse.json({ query: q, matchedModels: [], compatibleModels: [], partGroups: [] });
  }

  const matchedModelIds = matchedModels.map((m) => m.id);

  // 2. Find compatible peer models (bidirectional)
  const [asModel, asPeer] = await Promise.all([
    db.modelCompatibility.findMany({
      where: { modelId: { in: matchedModelIds } },
      include: { peer: { include: { brand: true } } },
    }),
    db.modelCompatibility.findMany({
      where: { peerId: { in: matchedModelIds } },
      include: { model: { include: { brand: true } } },
    }),
  ]);

  const peerMap = new Map<string, { id: string; name: string; brand?: string; partType: string }>();
  for (const c of asModel) {
    peerMap.set(c.peer.id, { id: c.peer.id, name: c.peer.name, brand: c.peer.brand?.name, partType: c.partType });
  }
  for (const c of asPeer) {
    peerMap.set(c.model.id, { id: c.model.id, name: c.model.name, brand: c.model.brand?.name, partType: c.partType });
  }
  const compatibleModels = Array.from(peerMap.values());

  // 3. All relevant model IDs (matched + peers)
  const allModelIds = Array.from(new Set([...matchedModelIds, ...compatibleModels.map((p) => p.id)]));

  // 4. Fetch all products for these models
  const products = await db.product.findMany({
    where: { ...bizFilter, modelId: { in: allModelIds }, active: true },
    include: {
      brand: true, model: true, partType: true, supplier: true,
      warehouse: true, shelf: true, images: { orderBy: { order: "asc" } },
    },
    orderBy: [{ partType: { name: "asc" } }, { quality: "asc" }, { stock: "desc" }],
  });

  // 5. Group by part type, then aggregate by quality
  const partGroupsMap = new Map<string, {
    partType: string;
    fitsModels: Set<string>;
    qualities: Map<string, { quality: string; totalStock: number; products: any[]; shelves: Set<string> }>;
    bestPrice: number;
    image: string | null;
  }>();

  for (const p of products) {
    const ptName = p.partType?.name ?? "Other";
    if (!partGroupsMap.has(ptName)) {
      partGroupsMap.set(ptName, {
        partType: ptName,
        fitsModels: new Set(),
        qualities: new Map(),
        bestPrice: p.sellingPrice,
        image: p.images?.[0]?.url ?? null,
      });
    }
    const group = partGroupsMap.get(ptName)!;

    if (p.model?.name) group.fitsModels.add(p.model.name);
    if (p.sellingPrice < group.bestPrice) group.bestPrice = p.sellingPrice;

    const quality = p.quality || "ORIGINAL";
    if (!group.qualities.has(quality)) {
      group.qualities.set(quality, { quality, totalStock: 0, products: [], shelves: new Set() });
    }
    const qGroup = group.qualities.get(quality)!;
    qGroup.totalStock += p.stock;
    qGroup.products.push(p);
    if (p.shelf?.code) qGroup.shelves.add(p.shelf.code);
  }

  // Convert to array and sort by part type priority
  const partTypeOrder = ["LCD", "OLED", "AMOLED", "Touch Glass", "Battery", "Frame", "Charging Flex", "Power Flex", "Volume Flex", "Front Camera", "Camera", "Speaker", "Earpiece", "Back Glass", "Housing", "Motherboard", "IC", "Buttons", "Sim Tray"];
  const partGroups = Array.from(partGroupsMap.values())
    .map((g) => ({
      partType: g.partType,
      fitsModels: Array.from(g.fitsModels),
      qualities: Array.from(g.qualities.values()).map((qg) => ({
        quality: qg.quality,
        totalStock: qg.totalStock,
        products: qg.products,
        shelves: Array.from(qg.shelves),
      })),
      bestPrice: g.bestPrice,
      image: g.image,
    }))
    .sort((a, b) => {
      const ai = partTypeOrder.indexOf(a.partType);
      const bi = partTypeOrder.indexOf(b.partType);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  return NextResponse.json({
    query: q,
    matchedModels: matchedModels.map((m) => ({ id: m.id, name: m.name, brand: m.brand?.name })),
    compatibleModels,
    partGroups,
  });
}
