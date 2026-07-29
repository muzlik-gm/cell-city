import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";
import { Prisma } from "@prisma/client";

// GET /api/search?q=<query>
// Universal search across products, phone models, compatibility, brands, customers, suppliers.
// Returns grouped results so the frontend can render everything at once.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q || q.length < 1) {
    return NextResponse.json({
      products: [],
      models: [],
      brands: [],
      customers: [],
      suppliers: [],
      compatibleProducts: [],
      sales: [],
      query: q,
    });
  }

  // 1. Direct product search (by name, sku, barcode, lcdCode, connector, model name, brand name)
  const businessId = await getBusinessId();
  const bizFilter = businessId ? { businessId } : {};
  const productWhere: Prisma.ProductWhereInput = {
    ...bizFilter,
    active: true,
    OR: [
      { name: { contains: q } },
      { sku: { contains: q } },
      { barcode: { contains: q } },
      { lcdCode: { contains: q } },
      { connectorType: { contains: q } },
      { model: { name: { contains: q } } },
      { brand: { name: { contains: q } } },
    ],
  };

  const [products, models, brands, customers, suppliers, sales] = await Promise.all([
    db.product.findMany({
      where: productWhere,
      include: {
        brand: true, model: true, partType: true, supplier: true,
        warehouse: true, shelf: true, images: { orderBy: { order: "asc" }, take: 1 },
      },
      orderBy: [{ stock: "desc" }, { name: "asc" }],
      take: 50,
    }),
    // 2. Phone models matching the query (scoped to business)
    db.phoneModel.findMany({
      where: { ...bizFilter, OR: [{ name: { contains: q } }, { slug: { contains: q } }] },
      include: { brand: true, _count: { select: { products: true } } },
      take: 10,
    }),
    // 3. Brands matching (scoped to business)
    db.brand.findMany({
      where: { ...bizFilter, OR: [{ name: { contains: q } }, { slug: { contains: q } }] },
      include: { _count: { select: { products: true } } },
      take: 5,
    }),
    // 4. Customers matching (scoped to business)
    db.customer.findMany({
      where: { ...bizFilter, OR: [{ name: { contains: q } }, { phone: { contains: q } }, { company: { contains: q } }] },
      take: 5,
    }),
    // 5. Suppliers matching (scoped to business)
    db.supplier.findMany({
      where: { ...bizFilter, OR: [{ name: { contains: q } }, { phone: { contains: q } }, { company: { contains: q } }] },
      take: 5,
    }),
    // 6. Recent sales matching (scoped to business)
    db.sale.findMany({
      where: { ...bizFilter, OR: [{ invoiceNo: { contains: q } }, { customer: { name: { contains: q } } }] },
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // 7. Compatibility: find models that match the query, then get their compatible peers,
  //    then fetch products for those peer models (so searching "M12" also shows A12 LCDs).
  const matchedModelIds = models.map((m) => m.id);
  let compatibleProducts: any[] = [];
  let compatibleModels: any[] = [];

  if (matchedModelIds.length > 0) {
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
      peerMap.set(c.peer.id + c.partType, { id: c.peer.id, name: c.peer.name, brand: c.peer.brand?.name, partType: c.partType });
    }
    for (const c of asPeer) {
      peerMap.set(c.model.id + c.partType, { id: c.model.id, name: c.model.name, brand: c.model.brand?.name, partType: c.partType });
    }
    compatibleModels = Array.from(peerMap.values());

    const allModelIds = Array.from(new Set([...matchedModelIds, ...compatibleModels.map((p) => p.id)]));
    compatibleProducts = await db.product.findMany({
      where: { modelId: { in: allModelIds }, active: true },
      include: {
        brand: true, model: true, partType: true, supplier: true,
        warehouse: true, shelf: true, images: { orderBy: { order: "asc" }, take: 1 },
      },
      orderBy: [{ stock: "desc" }, { name: "asc" }],
      take: 50,
    });
  }

  return NextResponse.json({
    query: q,
    products,
    models,
    brands,
    customers,
    suppliers,
    sales,
    compatibleModels,
    compatibleProducts,
    // Group products by partType for easy rendering
    productsByPartType: groupByPartType(products),
    compatibleByPartType: groupByPartType(compatibleProducts),
  });
}

function groupByPartType(products: any[]) {
  const groups: Record<string, any[]> = {};
  for (const p of products) {
    const key = p.partType?.name ?? "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return groups;
}
