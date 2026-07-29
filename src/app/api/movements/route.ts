import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET /api/movements — list ALL inventory movements with filters + pagination.
//   Filters: type (single or comma-list), productId, fromWarehouseId, toWarehouseId,
//            from (date), to (date).
//   Includes: product (brand/model), fromWarehouse, toWarehouse, user.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const productId = searchParams.get("productId");
  const fromWarehouseId = searchParams.get("fromWarehouseId");
  const toWarehouseId = searchParams.get("toWarehouseId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));

  const where: Prisma.InventoryMovementWhereInput = {};
  if (typeParam) {
    const types = typeParam.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length === 1) {
      where.type = types[0];
    } else if (types.length > 1) {
      where.type = { in: types };
    }
  }
  if (productId) where.productId = productId;
  if (fromWarehouseId) where.fromWarehouseId = fromWarehouseId;
  if (toWarehouseId) where.toWarehouseId = toWarehouseId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const [total, movements] = await Promise.all([
    db.inventoryMovement.count({ where }),
    db.inventoryMovement.findMany({
      where,
      include: {
        product: { include: { brand: true, model: true, partType: true } },
        fromWarehouse: true,
        toWarehouse: true,
        employee: true,
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data: movements, total, page, pageSize });
}
