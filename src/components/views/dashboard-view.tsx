"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingState, ErrorState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/format";
import {
  Wallet,
  TrendingUp,
  ShoppingCart,
  Truck,
  Boxes,
  Wrench,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Package,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
  Cell,
} from "recharts";
import { useAppStore } from "@/lib/store";
import { StockBadge } from "@/components/shared/badges";
import { motion } from "framer-motion";

const CHART_COLORS = ["oklch(0.55 0.13 162)", "oklch(0.65 0.18 60)", "oklch(0.6 0.2 300)", "oklch(0.7 0.15 200)", "oklch(0.62 0.22 20)", "oklch(0.72 0.16 180)"];

interface Summary {
  todaySalesTotal: number;
  todaySalesCount: number;
  todayPurchasesTotal: number;
  todayPurchasesCount: number;
  todayProfit: number;
  monthRevenue: number;
  monthProfit: number;
  inventoryValue: number;
  inventoryRetail: number;
  potentialProfit: number;
  totalProducts: number;
  totalStockUnits: number;
  pendingRepairs: number;
  lowStockCount: number;
}

export function DashboardView() {
  const { setView } = useAppStore();
  const summary = useQuery<Summary>({ queryKey: ["dash-summary"], queryFn: () => api.get("/dashboard/summary") });
  const charts = useQuery({ queryKey: ["dash-charts"], queryFn: () => api.get<any>("/dashboard/charts") });
  const latest = useQuery({ queryKey: ["dash-latest"], queryFn: () => api.get<any>("/dashboard/latest") });

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) return <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />;

  const s = summary.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your spare parts business"
        icon={Wallet}
        actions={
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </Badge>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's Sales" value={formatCurrency(s.todaySalesTotal)} icon={DollarSign} accent="emerald" subtitle={`${s.todaySalesCount} invoices`} trend={12} trendLabel="vs yesterday" />
        <StatCard label="Today's Profit" value={formatCurrency(s.todayProfit)} icon={TrendingUp} accent="teal" subtitle="From completed sales" trend={8} trendLabel="this week" />
        <StatCard label="Today's Purchases" value={formatCurrency(s.todayPurchasesTotal)} icon={Truck} accent="amber" subtitle={`${s.todayPurchasesCount} orders`} />
        <StatCard label="Inventory Value" value={formatCurrency(s.inventoryValue)} icon={Boxes} accent="purple" subtitle={`${formatNumber(s.totalStockUnits)} units · ${s.totalProducts} SKUs`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue trend */}
        <Card className="p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Revenue & Profit</h3>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-2.5 py-1 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Profit</span>
            </div>
          </div>
          <div className="h-[280px]">
            {charts.isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.data?.days ?? []} margin={{ left: 0, right: 12, top: 24, bottom: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.55 0.13 162)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.55 0.13 162)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.65 0.18 60)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.65 0.18 60)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "currentColor" }} className="fill-muted-foreground" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} height={20} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor" }} className="fill-muted-foreground" tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} width={44} domain={[0, "dataMax + 1000"]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12, boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.15)" }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.13 162)" strokeWidth={2} fill="url(#rev)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="profit" stroke="oklch(0.65 0.18 60)" strokeWidth={2} fill="url(#prof)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Top products */}
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Top Selling Products</h3>
              <p className="text-xs text-muted-foreground">By quantity sold</p>
            </div>
            <button onClick={() => setView("analytics")} className="text-xs font-medium text-primary hover:underline">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {(charts.data?.topProducts ?? []).length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No sales data yet</p>
            ) : (
              (charts.data?.topProducts ?? []).slice(0, 5).map((p: any, i: number) => (
                <div key={i} className="group flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-muted/50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium" title={p.name}>{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatCurrency(p.revenue)} revenue</p>
                  </div>
                  <Badge variant="secondary" className="font-semibold">{p.qty} sold</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Secondary stats + low stock */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Month Revenue" value={formatCurrency(s.monthRevenue)} icon={Wallet} accent="emerald" subtitle="This month" />
        <StatCard label="Month Profit" value={formatCurrency(s.monthProfit)} icon={TrendingUp} accent="teal" subtitle="This month" />
        <StatCard label="Pending Repairs" value={s.pendingRepairs} icon={Wrench} accent="purple" subtitle="Awaiting completion" />
      </div>

      {/* Latest activity + low stock */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Low stock */}
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Low Stock Alerts</h3>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600">{s.lowStockCount}</Badge>
            </div>
            <button onClick={() => setView("inventory")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Manage <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {(latest.data?.lowStock ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">All products well stocked</p>
            ) : (
              (latest.data?.lowStock ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                    {p.brand?.name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.shelf?.code ?? "—"} · {p.warehouse?.code ?? "—"}</p>
                  </div>
                  <StockBadge stock={p.stock} minStock={p.minStock} />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Latest sales */}
        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Latest Sales</h3>
            </div>
            <button onClick={() => setView("sales")} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {(latest.data?.latestSales ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No sales yet</p>
            ) : (
              (latest.data?.latestSales ?? []).map((sale: any) => (
                <div key={sale.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{sale.invoiceNo}</p>
                    <p className="text-[11px] text-muted-foreground">{sale.customer?.name ?? "Walk-in"} · {timeAgo(sale.createdAt)}</p>
                  </div>
                  <span className="text-sm font-bold">{formatCurrency(sale.total)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Top brands & models bar charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold">Popular Brands</h3>
          <div className="h-[220px]">
            {charts.isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.data?.topBrands ?? []} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                  <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
                    {(charts.data?.topBrands ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold">Most Sold Models</h3>
          <div className="h-[220px]">
            {charts.isLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.data?.topModels ?? []} layout="vertical" margin={{ left: 60, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }} />
                  <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                    {(charts.data?.topModels ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
