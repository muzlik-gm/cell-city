import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/analytics?range=30|90|365
// Comprehensive analytics:
//   - monthly revenue/profit trend (last 12 months)
//   - inventory value by part category
//   - top selling products (10)
//   - top brands, top models
//   - slow-moving inventory (no sales in last 30 days)
//   - fast-moving inventory (top sellers in range)
//   - supplier performance (total purchases, on-time %, rating, items supplied)
//   - customer statistics (top customers by spend)
//   - sales by payment method
//   - repair trends (by status, by month)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = Math.min(365, Math.max(7, Number(searchParams.get("range") ?? "30")));
  const now = new Date();
  const rangeStart = new Date(now.getTime() - range * 86400000);
  rangeStart.setHours(0, 0, 0, 0);

  // 12-month window (always 12 for trend stability)
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [sales, purchases, products, repairs, suppliers, customers, damages, partTypes] =
    await Promise.all([
      db.sale.findMany({
        where: { createdAt: { gte: rangeStart }, status: "COMPLETED" },
        include: {
          customer: true,
          items: { include: { product: { include: { brand: true, model: true, partType: true } } } },
        },
      }),
      db.purchase.findMany({
        where: { createdAt: { gte: rangeStart } },
        include: { supplier: true, items: true },
      }),
      db.product.findMany({
        where: { active: true },
        include: { brand: true, model: true, partType: true, warehouse: true, shelf: true },
      }),
      db.repairJob.findMany({
        where: { createdAt: { gte: monthStart } },
        include: { customer: true, model: { include: { brand: true } }, technician: true },
      }),
      db.supplier.findMany({
        where: { active: true },
        include: { _count: { select: { purchases: true, products: true } } },
      }),
      db.customer.findMany({ where: { active: true } }),
      db.damagedInventory.findMany({ where: { date: { gte: rangeStart } } }),
      db.partType.findMany(),
    ]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalProfit = sales.reduce((s, x) => s + x.profit, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const avgOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;
  const totalPurchaseSpend = purchases.reduce((s, x) => s + x.total, 0);

  // ── Monthly trend (last 12 months) ─────────────────────────────────────
  const months: { month: string; label: string; revenue: number; profit: number; orders: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const ms = sales.filter((s) => s.createdAt >= d && s.createdAt < next);
    months.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      revenue: ms.reduce((s, x) => s + x.total, 0),
      profit: ms.reduce((s, x) => s + x.profit, 0),
      orders: ms.length,
    });
  }

  // ── Inventory value by part category ───────────────────────────────────
  const catMap = new Map<string, { value: number; retail: number; units: number }>();
  for (const p of products) {
    const cat = p.partType?.category ?? "Misc";
    const cur = catMap.get(cat) ?? { value: 0, retail: 0, units: 0 };
    cur.value += p.purchasePrice * p.stock;
    cur.retail += p.sellingPrice * p.stock;
    cur.units += p.stock;
    catMap.set(cat, cur);
  }
  const inventoryByCategory = Array.from(catMap.entries()).map(([category, v]) => ({
    category,
    ...v,
    potentialProfit: v.retail - v.value,
  })).sort((a, b) => b.value - a.value);

  // ── Top selling products (10) ──────────────────────────────────────────
  const prodMap = new Map<string, {
    name: string; sku: string; brand: string | null; model: string | null;
    qty: number; revenue: number; profit: number;
  }>();
  for (const s of sales) {
    for (const it of s.items) {
      const key = it.productId;
      const ex = prodMap.get(key) ?? {
        name: it.name, sku: it.product?.sku ?? "", brand: it.product?.brand?.name ?? null,
        model: it.product?.model?.name ?? null, qty: 0, revenue: 0, profit: 0,
      };
      ex.qty += it.qty;
      ex.revenue += it.total;
      ex.profit += it.total - it.cost * it.qty;
      prodMap.set(key, ex);
    }
  }
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // ── Top brands ─────────────────────────────────────────────────────────
  const brandMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const s of sales) {
    for (const it of s.items) {
      const b = it.product?.brand?.name ?? "Unknown";
      const ex = brandMap.get(b) ?? { name: b, qty: 0, revenue: 0 };
      ex.qty += it.qty;
      ex.revenue += it.total;
      brandMap.set(b, ex);
    }
  }
  const topBrands = Array.from(brandMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // ── Top models ─────────────────────────────────────────────────────────
  const modelMap = new Map<string, { name: string; brand: string; qty: number; revenue: number }>();
  for (const s of sales) {
    for (const it of s.items) {
      const m = it.product?.model?.name ?? "Unknown";
      const b = it.product?.brand?.name ?? "Unknown";
      const ex = modelMap.get(m) ?? { name: m, brand: b, qty: 0, revenue: 0 };
      ex.qty += it.qty;
      ex.revenue += it.total;
      modelMap.set(m, ex);
    }
  }
  const topModels = Array.from(modelMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // ── Sales by payment method ────────────────────────────────────────────
  const payMap = new Map<string, { method: string; count: number; total: number }>();
  for (const s of sales) {
    const ex = payMap.get(s.paymentMethod) ?? { method: s.paymentMethod, count: 0, total: 0 };
    ex.count += 1;
    ex.total += s.total;
    payMap.set(s.paymentMethod, ex);
  }
  const salesByPaymentMethod = Array.from(payMap.values()).sort((a, b) => b.total - a.total);

  // ── Slow-moving inventory: no sales in last 30 days ────────────────────
  const slowStart = new Date(now.getTime() - 30 * 86400000);
  const soldProductIds = new Set<string>();
  for (const s of sales) {
    if (s.createdAt >= slowStart) {
      for (const it of s.items) soldProductIds.add(it.productId);
    }
  }
  // Also include repairs (parts used) in the 30-day window
  const recentRepairParts = await db.repairJobPart.findMany({
    where: { repair: { createdAt: { gte: slowStart } }, used: true },
    select: { productId: true },
  });
  for (const p of recentRepairParts) soldProductIds.add(p.productId);

  const slowMoving = products
    .filter((p) => !soldProductIds.has(p.id) && p.stock > 0)
    .map((p) => ({
      id: p.id, name: p.name, sku: p.sku,
      brand: p.brand?.name ?? null, model: p.model?.name ?? null,
      partType: p.partType?.name ?? null,
      stock: p.stock, purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice,
      inventoryValue: p.purchasePrice * p.stock,
      daysSinceLastSale: 30,
    }))
    .sort((a, b) => b.inventoryValue - a.inventoryValue)
    .slice(0, 30);

  // ── Fast-moving: top sellers in range ──────────────────────────────────
  const fastMoving: {
    id: string; name: string; sku: string; brand: string | null; model: string | null;
    qty: number; revenue: number; profit: number; stock: number; inventoryValue: number;
  }[] = Array.from(prodMap.entries())
    .map(([id, v]) => ({ id, ...v, stock: 0, inventoryValue: 0 }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 15);
  // Augment with current stock info
  const fastIds = fastMoving.map((f) => f.id);
  const fastProducts = products.filter((p) => fastIds.includes(p.id));
  for (const f of fastMoving) {
    const p = fastProducts.find((pp) => pp.id === f.id);
    if (p) {
      f.stock = p.stock;
      f.inventoryValue = p.purchasePrice * p.stock;
    }
  }

  // ── Supplier performance ───────────────────────────────────────────────
  const supMap = new Map<string, {
    name: string; company: string | null; rating: number;
    purchases: number; totalSpent: number; itemsSupplied: number; received: number; outstanding: number;
  }>();
  for (const p of purchases) {
    if (!p.supplierId) continue;
    const sup = suppliers.find((s) => s.id === p.supplierId);
    const name = sup?.name ?? "Unknown";
    const ex = supMap.get(p.supplierId) ?? {
      name, company: sup?.company ?? null, rating: sup?.rating ?? 3,
      purchases: 0, totalSpent: 0, itemsSupplied: 0, received: 0, outstanding: 0,
    };
    ex.purchases += 1;
    ex.totalSpent += p.total;
    ex.outstanding += Math.max(0, p.total - p.paid);
    if (p.status === "RECEIVED") ex.received += 1;
    for (const it of p.items) ex.itemsSupplied += it.qty;
    supMap.set(p.supplierId, ex);
  }
  // Include suppliers with no purchases in range too (so they appear with zero)
  for (const sup of suppliers) {
    if (!supMap.has(sup.id)) {
      supMap.set(sup.id, {
        name: sup.name, company: sup.company, rating: sup.rating,
        purchases: 0, totalSpent: 0, itemsSupplied: 0, received: 0, outstanding: 0,
      });
    }
  }
  const supplierPerformance = Array.from(supMap.values()).map((s) => ({
    ...s,
    onTimeRate: s.purchases > 0 ? Math.round((s.received / s.purchases) * 100) : 0,
  })).sort((a, b) => b.totalSpent - a.totalSpent);

  // ── Top customers by spend ─────────────────────────────────────────────
  const custMap = new Map<string, { name: string; phone: string | null; company: string | null; orders: number; spent: number; outstanding: number }>();
  for (const s of sales) {
    if (!s.customerId) continue;
    const c = customers.find((cc) => cc.id === s.customerId);
    const ex = custMap.get(s.customerId) ?? {
      name: c?.name ?? "Walk-in", phone: c?.phone ?? null, company: c?.company ?? null,
      orders: 0, spent: 0, outstanding: 0,
    };
    ex.orders += 1;
    ex.spent += s.total;
    if (s.paymentStatus !== "PAID") ex.outstanding += Math.max(0, s.total - s.paid);
    custMap.set(s.customerId, ex);
  }
  const topCustomers = Array.from(custMap.values()).sort((a, b) => b.spent - a.spent).slice(0, 10);

  // ── Repair trends ──────────────────────────────────────────────────────
  const repairByStatus = new Map<string, number>();
  for (const r of repairs) {
    repairByStatus.set(r.status, (repairByStatus.get(r.status) ?? 0) + 1);
  }
  const repairStatuses = ["RECEIVED", "DIAGNOSED", "WAITING_PARTS", "REPAIRING", "COMPLETED", "DELIVERED", "CANCELLED"];
  const repairByStatusArr = repairStatuses.map((st) => ({ status: st, count: repairByStatus.get(st) ?? 0 }));

  const repairByMonth: { month: string; label: string; count: number; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const mr = repairs.filter((r) => r.createdAt >= d && r.createdAt < next);
    repairByMonth.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-GB", { month: "short" }),
      count: mr.length,
      revenue: mr.reduce((s, x) => s + x.total, 0),
    });
  }

  // ── Damage summary ─────────────────────────────────────────────────────
  const damageByReason = new Map<string, { reason: string; count: number; units: number; value: number }>();
  for (const d of damages) {
    const ex = damageByReason.get(d.reason) ?? { reason: d.reason, count: 0, units: 0, value: 0 };
    ex.count += 1;
    ex.units += d.qty;
    damageByReason.set(d.reason, ex);
  }
  const damageSummary = Array.from(damageByReason.values()).sort((a, b) => b.units - a.units);

  return NextResponse.json({
    range,
    kpis: {
      totalRevenue,
      totalProfit,
      profitMargin,
      avgOrderValue,
      totalOrders: sales.length,
      totalPurchaseSpend,
      totalDamages: damages.reduce((s, d) => s + d.qty, 0),
      damageValue: damages.reduce((s, d) => {
        const p = products.find((pp) => pp.id === d.productId);
        return s + d.qty * (p?.purchasePrice ?? 0);
      }, 0),
    },
    monthlyTrend: months,
    inventoryByCategory,
    topProducts,
    topBrands,
    topModels,
    salesByPaymentMethod,
    slowMoving,
    fastMoving,
    supplierPerformance,
    topCustomers,
    repairByStatus: repairByStatusArr,
    repairByMonth,
    damageSummary,
  });
}
