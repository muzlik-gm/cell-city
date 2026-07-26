"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number; // percentage
  trendLabel?: string;
  accent?: "emerald" | "amber" | "purple" | "teal" | "rose";
  subtitle?: string;
}

const accentMap = {
  emerald: { bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  purple: { bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
  teal: { bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400", bar: "bg-teal-500" },
  rose: { bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400", bar: "bg-rose-500" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = "emerald",
  subtitle,
}: StatCardProps) {
  const up = (trend ?? 0) >= 0;
  const a = accentMap[accent];
  return (
    <Card className="group relative overflow-hidden p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* accent bar on the left edge */}
      <div className={cn("absolute inset-y-0 left-0 w-1", a.bar, "opacity-70 transition-opacity group-hover:opacity-100")} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 whitespace-nowrap text-2xl font-bold tracking-tight tabular-nums [overflow-wrap:anywhere]" title={typeof value === "string" ? value : undefined}>
            {value}
          </p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold",
                  up ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/50", a.bg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
