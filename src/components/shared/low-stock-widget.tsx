"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, MapPin, ChevronRight, Loader2, PackageX } from "lucide-react";

/**
 * Compact low-stock alert widget for the home hero.
 *
 * Pulls `/api/dashboard/latest` (returns `lowStock[]`) and
 * `/api/dashboard/summary` (returns `lowStockCount`). Shows up to the first
 * 5 low-stock products in a scrollable list. Clicking a row jumps to the
 * Inventory view via `useAppStore.setView("inventory")`. When there are no
 * low-stock items, a positive empty state ("All stocked up") is shown.
 */
export function LowStockWidget() {
  const setView = useAppStore((s) => s.setView);

  const latestQ = useQuery({
    queryKey: ["home-lowstock"],
    queryFn: () => api.get<{ lowStock: any[] }>("/dashboard/latest"),
    staleTime: 30_000,
  });

  const summaryQ = useQuery({
    queryKey: ["home-lowstock-summary"],
    queryFn: () => api.get<{ lowStockCount: number }>("/dashboard/summary"),
    staleTime: 30_000,
  });

  const loading = latestQ.isLoading || summaryQ.isLoading;
  const count = summaryQ.data?.lowStockCount ?? 0;
  const items = (latestQ.data?.lowStock ?? []).slice(0, 5);
  const isEmpty = !loading && count === 0 && items.length === 0;

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-rose-500/20 bg-card p-0 shadow-soft">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-rose-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold">Low Stock Alerts</h3>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : count > 0 ? (
          <Badge
            variant="outline"
            className="border-rose-500/30 bg-rose-500/10 font-semibold text-rose-600 dark:text-rose-400"
          >
            {count} {count === 1 ? "item" : "items"}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-600 dark:text-emerald-400"
          >
            0
          </Badge>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-muted/50"
              aria-hidden
            />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            All stocked up
          </p>
          <p className="text-xs text-muted-foreground">
            No products are below their minimum stock level.
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-48">
          <ul className="divide-y">
            {items.map((p: any) => {
              const stock = Number(p.stock ?? 0);
              const minStock = Number(p.minStock ?? 0);
              const out = stock <= 0;
              const low = !out && stock <= minStock;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setView("inventory")}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-accent/40"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        out
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      <PackageX className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={p.name}>
                        {p.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {p.shelf?.code && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {p.shelf.code}
                          </span>
                        )}
                        {p.partType?.name && (
                          <span className="truncate">· {p.partType.name}</span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-semibold",
                        out
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {out ? "Out" : `${stock} left`}
                    </Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Footer CTA — only if there are more low-stock items beyond the top 5 */}
          {count > items.length && (
            <button
              type="button"
              onClick={() => setView("inventory")}
              className="flex w-full items-center justify-center gap-1.5 border-t px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5"
            >
              View all {count} low-stock items
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </ScrollArea>
      )}
    </Card>
  );
}
