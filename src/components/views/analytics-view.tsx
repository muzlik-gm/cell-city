"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Receipt,
  Truck,
  Boxes,
  Package,
  Users,
  Zap,
  Snail,
  Star,
  Activity,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";

const CHART_COLORS = [
  "oklch(0.55 0.13 162)", // emerald
  "oklch(0.65 0.18 60)",  // amber
  "oklch(0.6 0.2 300)",   // purple
  "oklch(0.7 0.15 200)",  // teal
  "oklch(0.62 0.22 20)",  // red-orange
  "oklch(0.72 0.16 180)", // cyan-teal
  "oklch(0.55 0.16 145)", // green
  "oklch(0.7 0.16 80)",   // yellow
];

type Row = Record<string, unknown>;

type AnalyticsData = {
  range: number;
  kpis: {
    totalRevenue: number;
    totalProfit: number;
    profitMargin: number;
    avgOrderValue: number;
    totalOrders: number;
    totalPurchaseSpend: number;
    totalDamages: number;
    damageValue: number;
  };
  monthlyTrend: { month: string; label: string; revenue: number; profit: number; orders: number }[];
  inventoryByCategory: { category: string; value: number; retail: number; units: number; potentialProfit: number }[];
  topProducts: { name: string; sku: string; brand: string | null; model: string | null; qty: number; revenue: number; profit: number }[];
  topBrands: { name: string; qty: number; revenue: number }[];
  topModels: { name: string; brand: string; qty: number; revenue: number }[];
  salesByPaymentMethod: { method: string; count: number; total: number }[];
  slowMoving: { id: string; name: string; sku: string; brand: string | null; model: string | null; partType: string | null; stock: number; purchasePrice: number; sellingPrice: number; inventoryValue: number }[];
  fastMoving: { id: string; name: string; sku: string; brand: string | null; model: string | null; qty: number; revenue: number; profit: number; stock: number; inventoryValue: number }[];
  supplierPerformance: { name: string; company: string | null; rating: number; purchases: number; totalSpent: number; itemsSupplied: number; received: number; outstanding: number; onTimeRate: number }[];
  topCustomers: { name: string; phone: string | null; company: string | null; orders: number; spent: number; outstanding: number }[];
  repairByStatus: { status: string; count: number }[];
  repairByMonth: { month: string; label: string; count: number; revenue: number }[];
  damageSummary: { reason: string; count: number; units: number; value: number }[];
};

const RANGES = [
  { value: 30, label: "30 Days" },
  { value: 90, label: "90 Days" },
  { value: 365, label: "1 Year" },
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.15)",
};

export function AnalyticsView() {
  const [range, setRange] = useState(30);
  const { data, isLoading, isError, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ["analytics", range],
    queryFn: () => api.get(`/analytics?range=${range}`),
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={error?.message ?? "Failed to load analytics"} onRetry={() => refetch()} />;
  if (!data) return null;

  const k = data.kpis;
  const sym = "Rs";

  // Build a rank map for top products
  const rankBySku = new Map<string, number>();
  data.topProducts.forEach((p, i) => rankBySku.set(p.sku, i + 1));

  const productCols: Column<Row>[] = [
    {
      key: "rank",
      header: "#",
      render: (r) => <span className="font-bold text-primary">{rankBySku.get(r.sku as string) ?? "—"}</span>,
      className: "w-10",
    },
    {
      key: "name",
      header: "Product",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name as string}</p>
          <p className="text-xs text-muted-foreground">{r.brand as string} · {(r.model as string) ?? "—"}</p>
        </div>
      ),
    },
    { key: "sku", header: "SKU", render: (r) => <span className="font-mono text-xs">{r.sku as string}</span> },
    { key: "qty", header: "Qty Sold", render: (r) => <Badge variant="secondary">{r.qty as number}</Badge> },
    { key: "revenue", header: "Revenue", render: (r) => <span className="font-semibold">{formatCurrency(r.revenue as number, sym)}</span> },
    { key: "profit", header: "Profit", render: (r) => <span className="font-semibold text-emerald-600">{formatCurrency(r.profit as number, sym)}</span> },
  ];

  const categoryCols: Column<Row>[] = [
    { key: "category", header: "Category", render: (r) => <span className="font-medium">{r.category as string}</span> },
    { key: "units", header: "Units", render: (r) => <span>{formatNumber(r.units as number)}</span> },
    { key: "value", header: "Inventory Cost", render: (r) => <span className="font-semibold">{formatCurrency(r.value as number, sym)}</span> },
    { key: "retail", header: "Retail Value", render: (r) => <span className="font-semibold text-emerald-600">{formatCurrency(r.retail as number, sym)}</span> },
    { key: "potentialProfit", header: "Potential Profit", render: (r) => <span className="font-semibold text-primary">{formatCurrency(r.potentialProfit as number, sym)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Deep insights into your sales, inventory velocity, and supplier performance"
        icon={BarChart3}
        actions={
          <div className="inline-flex items-center rounded-lg border bg-card p-1 shadow-soft">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  range === r.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Total Revenue" value={formatCurrency(k.totalRevenue, sym)} icon={DollarSign} accent="emerald" subtitle={`${k.totalOrders} orders`} />
        <StatCard label="Total Profit" value={formatCurrency(k.totalProfit, sym)} icon={TrendingUp} accent="teal" subtitle={`Margin ${k.profitMargin.toFixed(1)}%`} />
        <StatCard label="Profit Margin" value={`${k.profitMargin.toFixed(1)}%`} icon={Activity} accent="amber" subtitle={`Avg order ${formatCurrency(k.avgOrderValue, sym)}`} />
        <StatCard label="Purchase Spend" value={formatCurrency(k.totalPurchaseSpend, sym)} icon={Truck} accent="purple" subtitle={`Damages ${formatCurrency(k.damageValue, sym)}`} />
      </motion.div>

      {/* Charts row 1: Monthly trend + Category pie */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Revenue & Profit Trend</h3>
              <p className="text-xs text-muted-foreground">Last 12 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Profit</span>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrend} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.13 162)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.55 0.13 162)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.65 0.18 60)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.65 0.18 60)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => [formatCurrency(v, sym), name === "revenue" ? "Revenue" : "Profit"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.13 162)" strokeWidth={2} fill="url(#revArea)" />
                <Area type="monotone" dataKey="profit" stroke="oklch(0.65 0.18 60)" strokeWidth={2} fill="url(#profArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Inventory Value by Category</h3>
            <p className="text-xs text-muted-foreground">At purchase cost</p>
          </div>
          <div className="h-[280px]">
            {data.inventoryByCategory.length === 0 ? (
              <EmptyState icon={Boxes} title="No inventory" description="No products in catalog yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.inventoryByCategory} dataKey="value" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={88} paddingAngle={2}>
                    {data.inventoryByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, n: string) => [formatCurrency(v, sym), n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Charts row 2: Payment method donut + Repair status donut + Repair trend bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Sales by Payment Method</h3>
            <p className="text-xs text-muted-foreground">Last {range} days</p>
          </div>
          <div className="h-[240px]">
            {data.salesByPaymentMethod.length === 0 ? (
              <EmptyState icon={Receipt} title="No sales" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.salesByPaymentMethod} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={48} outerRadius={88} paddingAngle={2}>
                    {data.salesByPaymentMethod.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [formatCurrency(v, sym), n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Repair Status Distribution</h3>
            <p className="text-xs text-muted-foreground">Last 12 months</p>
          </div>
          <div className="h-[240px]">
            {data.repairByStatus.every((s) => s.count === 0) ? (
              <EmptyState icon={Wrench} title="No repairs" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.repairByStatus.filter((s) => s.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={48} outerRadius={88} paddingAngle={2}>
                    {data.repairByStatus.filter((s) => s.count > 0).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4">
            <h3 className="text-sm font-semibold">Repair Volume Trend</h3>
            <p className="text-xs text-muted-foreground">Tickets per month</p>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.repairByMonth} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="oklch(0.6 0.2 300)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Inventory velocity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Snail className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Slow-Moving Inventory</h3>
                <p className="text-xs text-muted-foreground">No sales in 30 days</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600">{data.slowMoving.length}</Badge>
          </div>
          <div className="max-h-96 overflow-y-auto pr-1">
            {data.slowMoving.length === 0 ? (
              <EmptyState icon={Zap} title="All products moving!" description="No slow-moving inventory in the last 30 days." />
            ) : (
              <div className="space-y-2">
                {data.slowMoving.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                      {(p.brand ?? "?")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.brand} · {p.partType ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{p.stock} <span className="text-muted-foreground font-normal">in stock</span></p>
                      <p className="text-[11px] text-muted-foreground">{formatCurrency(p.inventoryValue, sym)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Fast-Moving Inventory</h3>
                <p className="text-xs text-muted-foreground">Top sellers in {range} days</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">{data.fastMoving.length}</Badge>
          </div>
          <div className="max-h-96 overflow-y-auto pr-1">
            {data.fastMoving.length === 0 ? (
              <EmptyState icon={Package} title="No sales data" description="No sales recorded in the selected range." />
            ) : (
              <div className="space-y-2">
                {data.fastMoving.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.brand} · {p.qty} sold</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{formatCurrency(p.revenue, sym)}</p>
                      <p className="text-[11px] text-muted-foreground">{p.stock} left</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top selling products table */}
      <Card className="p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top Selling Products</h3>
          <Badge variant="secondary">Last {range} days</Badge>
        </div>
        <DataTable
          columns={productCols}
          data={data.topProducts as unknown as Row[]}
          emptyTitle="No sales yet"
          emptyDescription="Top sellers will appear here once you make sales."
          rowKey={(r) => (r.sku as string) ?? Math.random().toString()}
        />
      </Card>

      {/* Top brands + Top models side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Top Brands</h3>
          </div>
          <div className="h-[260px]">
            {data.topBrands.length === 0 ? (
              <EmptyState icon={Star} title="No sales" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topBrands} layout="vertical" margin={{ left: 60, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} units`, "Qty Sold"]}
                  />
                  <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                    {data.topBrands.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Top Models</h3>
          </div>
          <div className="h-[260px]">
            {data.topModels.length === 0 ? (
              <EmptyState icon={Package} title="No sales" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topModels} layout="vertical" margin={{ left: 60, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} units`, "Qty Sold"]} />
                  <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                    {data.topModels.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Top customers + Supplier performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Top Customers</h3>
          </div>
          {data.topCustomers.length === 0 ? (
            <EmptyState icon={Users} title="No customer sales" />
          ) : (
            <div className="space-y-2">
              {data.topCustomers.map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {(c.name?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.company ?? c.phone ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(c.spent, sym)}</p>
                    <p className="text-xs text-muted-foreground">{c.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Supplier Performance</h3>
          </div>
          <div className="max-h-96 overflow-y-auto pr-1">
            {data.supplierPerformance.length === 0 ? (
              <EmptyState icon={Truck} title="No suppliers" />
            ) : (
              <div className="space-y-2">
                {data.supplierPerformance.slice(0, 10).map((s, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.purchases} orders · {s.itemsSupplied} items</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(s.totalSpent, sym)}</p>
                        <p className="text-xs text-muted-foreground">{s.outstanding > 0 ? `Owe ${formatCurrency(s.outstanding, sym)}` : "Settled"}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>On-time</span>
                          <span className="font-medium">{s.onTimeRate}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${s.onTimeRate}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} className={`h-3 w-3 ${idx < s.rating ? "fill-current" : "opacity-30"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Inventory by category breakdown */}
      <Card className="p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Inventory Value Breakdown</h3>
          <Badge variant="secondary">{data.inventoryByCategory.length} categories</Badge>
        </div>
        <DataTable
          columns={categoryCols}
          data={data.inventoryByCategory as unknown as Row[]}
          emptyTitle="No inventory"
          rowKey={(r) => (r.category as string) ?? Math.random().toString()}
        />
      </Card>

      <div className="flex justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs text-muted-foreground">
          <Activity className="mr-1.5 h-3.5 w-3.5" /> Refresh analytics
        </Button>
      </div>
    </div>
  );
}
