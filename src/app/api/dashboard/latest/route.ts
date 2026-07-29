import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";

// Latest sales, latest purchases, low stock items for dashboard widgets.
export async function GET() {
  const [latestSales, latestPurchases, lowStock, pendingRepairs] = await Promise.all([
    db.sale.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: true },
    }),
    db.purchase.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { supplier: true, items: true },
    }),
    db.product.findMany({
      where: { active: true, stock: { lte: db.product.fields.minStock } },
      take: 6,
      orderBy: { stock: "asc" },
      include: { brand: true, model: true, partType: true, shelf: true, warehouse: true },
    }),
    db.repairJob.findMany({
      where: { status: { in: ["RECEIVED", "DIAGNOSED", "WAITING_PARTS", "REPAIRING"] } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true, model: true },
    }),
  ]);

  return NextResponse.json({ latestSales, latestPurchases, lowStock, pendingRepairs });
}
