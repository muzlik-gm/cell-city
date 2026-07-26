import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Dashboard summary: today's sales/purchases/revenue/profit, inventory value, pending repairs.
export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales, todayPurchases, monthSales, products, pendingRepairs] = await Promise.all([
    db.sale.findMany({
      where: { createdAt: { gte: startOfToday }, status: "COMPLETED" },
      include: { items: true, customer: true },
    }),
    db.purchase.findMany({
      where: { createdAt: { gte: startOfToday } },
    }),
    db.sale.findMany({
      where: { createdAt: { gte: startOfMonth }, status: "COMPLETED" },
    }),
    db.product.findMany({ where: { active: true } }),
    db.repairJob.count({
      where: { status: { in: ["RECEIVED", "DIAGNOSED", "WAITING_PARTS", "REPAIRING"] } },
    }),
  ]);

  const todaySalesTotal = todaySales.reduce((s, x) => s + x.total, 0);
  const todayPurchasesTotal = todayPurchases.reduce((s, x) => s + x.total, 0);
  const todayProfit = todaySales.reduce((s, x) => s + x.profit, 0);
  const monthRevenue = monthSales.reduce((s, x) => s + x.total, 0);
  const monthProfit = monthSales.reduce((s, x) => s + x.profit, 0);
  const inventoryValue = products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
  const inventoryRetail = products.reduce((s, p) => s + p.sellingPrice * p.stock, 0);
  const totalStockUnits = products.reduce((s, p) => s + p.stock, 0);
  const lowStockCount = await db.product.count({
    where: { active: true, stock: { lte: db.product.fields.minStock } },
  });

  return NextResponse.json({
    todaySalesTotal,
    todaySalesCount: todaySales.length,
    todayPurchasesTotal,
    todayPurchasesCount: todayPurchases.length,
    todayProfit,
    monthRevenue,
    monthProfit,
    inventoryValue,
    inventoryRetail,
    potentialProfit: inventoryRetail - inventoryValue,
    totalProducts: products.length,
    totalStockUnits,
    pendingRepairs,
    lowStockCount,
  });
}
