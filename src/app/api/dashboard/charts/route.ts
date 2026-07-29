import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/business-context";

// Charts: 30-day revenue/profit trend, top selling products, top brands, top models.
export async function GET() {
  const now = new Date();
  const start = new Date(now.getTime() - 29 * 86400000);
  start.setHours(0, 0, 0, 0);

  const sales = await db.sale.findMany({
    where: { createdAt: { gte: start }, status: "COMPLETED" },
    include: { items: { include: { product: { include: { brand: true, model: true } } } } },
  });

  // daily trend
  const days: { date: string; revenue: number; profit: number; label: string }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d.getTime() + 86400000);
    const daySales = sales.filter((s) => s.createdAt >= d && s.createdAt < next);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      revenue: daySales.reduce((s, x) => s + x.total, 0),
      profit: daySales.reduce((s, x) => s + x.profit, 0),
    });
  }

  // top selling products by qty
  const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const s of sales) {
    for (const it of s.items) {
      const key = it.productId;
      const existing = prodMap.get(key) ?? { name: it.name, qty: 0, revenue: 0 };
      existing.qty += it.qty;
      existing.revenue += it.total;
      prodMap.set(key, existing);
    }
  }
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 6);

  // top brands
  const brandMap = new Map<string, number>();
  for (const s of sales) {
    for (const it of s.items) {
      const b = it.product?.brand?.name ?? "Unknown";
      brandMap.set(b, (brandMap.get(b) ?? 0) + it.qty);
    }
  }
  const topBrands = Array.from(brandMap.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);

  // top models
  const modelMap = new Map<string, number>();
  for (const s of sales) {
    for (const it of s.items) {
      const m = it.product?.model?.name ?? "Unknown";
      modelMap.set(m, (modelMap.get(m) ?? 0) + it.qty);
    }
  }
  const topModels = Array.from(modelMap.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);

  return NextResponse.json({ days, topProducts, topBrands, topModels });
}
