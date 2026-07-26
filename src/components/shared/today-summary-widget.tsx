"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  DollarSign,
  TrendingUp,
  Wrench,
  AlertTriangle,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

/**
 * Today's business pulse — a compact 4-tile stat strip for the home hero.
 *
 * Pulls `/api/dashboard/summary` and renders four clickable tiles in a single
 * row on desktop (2x2 on mobile): Today's Sales (emerald), Today's Profit
 * (teal, with a vs-daily-average trend), Pending Repairs (purple → repairs
 * view), Low Stock (amber → inventory view). Skeleton tiles while loading.
 */

interface DashboardSummary {
  todaySalesTotal: number;
  todaySalesCount: number;
  todayProfit: number;
  monthProfit: number;
  pendingRepairs: number;
  lowStockCount: number;
}

type AccentKey = "emerald" | "teal" | "purple" | "amber";

interface Tile {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  accent: AccentKey;
  onClick?: () => void;
  trend?: "up" | "down" | "neutral";
}

const ACCENTS: Record<
  AccentKey,
  { icon: string; bar: string }
> = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  teal: {
    icon: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    bar: "bg-teal-500",
  },
  purple: {
    icon: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    bar: "bg-purple-500",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
};

function SkeletonTiles() {
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[88px] animate-pulse rounded-xl border bg-muted/50"
          aria-hidden
        />
      ))}
    </div>
  );
}

export function TodaySummaryWidget() {
  const mounted = useMounted();
  const setView = useAppStore((s) => s.setView);

  const { data, isError } = useQuery({
    queryKey: ["home-today-summary"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
    staleTime: 30_000,
    enabled: mounted,
  });

  if (!data) {
    if (isError) {
      return (
        <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex h-[88px] items-center justify-center rounded-xl border border-dashed bg-card text-[10px] font-medium text-muted-foreground"
            >
              Unavailable
            </div>
          ))}
        </div>
      );
    }
    return <SkeletonTiles />;
  }

  // Trend: today's profit vs the running monthly daily average.
  const dayOfMonth = Math.max(new Date().getDate(), 1);
  const avgDailyProfit = data.monthProfit / dayOfMonth;
  let profitTrendPct: number | null = null;
  let profitTrendDir: "up" | "down" | "neutral" = "neutral";
  if (avgDailyProfit > 0) {
    profitTrendPct = Math.round(
      ((data.todayProfit - avgDailyProfit) / avgDailyProfit) * 100,
    );
    profitTrendDir = profitTrendPct >= 0 ? "up" : "down";
  } else if (data.todayProfit > 0) {
    profitTrendPct = 100;
    profitTrendDir = "up";
  }

  const tiles: Tile[] = [
    {
      label: "Today's Sales",
      value: formatCurrency(data.todaySalesTotal),
      sub: `${data.todaySalesCount} sale${
        data.todaySalesCount === 1 ? "" : "s"
      }`,
      icon: DollarSign,
      accent: "emerald",
      onClick: () => setView("sales"),
    },
    {
      label: "Today's Profit",
      value: formatCurrency(data.todayProfit),
      sub:
        profitTrendPct === null
          ? "no baseline yet"
          : `${profitTrendPct >= 0 ? "+" : ""}${profitTrendPct}% vs avg`,
      icon: TrendingUp,
      accent: "teal",
      onClick: () => setView("reports"),
      trend: profitTrendDir,
    },
    {
      label: "Pending Repairs",
      value: data.pendingRepairs,
      sub:
        data.pendingRepairs > 0
          ? "needs attention"
          : "all clear",
      icon: Wrench,
      accent: "purple",
      onClick: () => setView("repairs"),
      trend: data.pendingRepairs > 0 ? "down" : "up",
    },
    {
      label: "Low Stock",
      value: data.lowStockCount,
      sub: data.lowStockCount > 0 ? "restock soon" : "all stocked",
      icon: AlertTriangle,
      accent: "amber",
      onClick: () => setView("inventory"),
      trend: data.lowStockCount > 0 ? "down" : "up",
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {tiles.map((t) => {
        const a = ACCENTS[t.accent];
        const Icon = t.icon;
        const isInteractive = !!t.onClick;
        const Comp = isInteractive ? "button" : "div";
        return (
          <Comp
            key={t.label}
            type={isInteractive ? "button" : undefined}
            onClick={t.onClick}
            aria-label={isInteractive ? `Open ${t.label} view` : undefined}
            className={cn(
              "group relative flex h-[88px] w-full flex-col justify-between overflow-hidden rounded-xl border bg-card p-3 text-left shadow-soft ring-1 ring-inset ring-border/40 transition",
              isInteractive &&
                "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            )}
          >
            {/* Accent edge */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-0.5 opacity-70 transition-opacity group-hover:opacity-100",
                a.bar,
              )}
            />

            {/* Top row: icon + arrow */}
            <div className="flex items-center justify-between pl-1.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg",
                  a.icon,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {isInteractive && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
              )}
            </div>

            {/* Bottom: value + label + sub */}
            <div className="pl-1.5">
              <p className="truncate text-[22px] font-bold leading-tight tracking-tight tabular-nums">
                {t.value}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                {t.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide",
                  t.label === "Today's Profit" && t.trend === "up" &&
                    "text-emerald-600 dark:text-emerald-400",
                  t.label === "Today's Profit" && t.trend === "down" &&
                    "text-rose-600 dark:text-rose-400",
                  t.label !== "Today's Profit" && "text-muted-foreground",
                )}
              >
                {t.sub}
              </p>
            </div>
          </Comp>
        );
      })}
    </div>
  );
}
