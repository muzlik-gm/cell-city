"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { TrendingUp, ChevronRight, Loader2, Crown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

/**
 * Top Parts by Revenue widget for the home hero.
 * Shows the top 6 products by revenue from the last 30 days.
 * Clicking a row searches for that product on the home page.
 */
export function TopPartsWidget() {
  const setView = useAppStore((s) => s.setView);

  const chartsQ = useQuery({
    queryKey: ["home-top-parts"],
    queryFn: () => api.get<{ topProducts: any[] }>("/dashboard/charts"),
    staleTime: 60_000,
  });

  const products = chartsQ.data?.topProducts ?? [];

  const handleSearch = (name: string) => {
    // Fill the universal search input with the product name
    const input = document.getElementById("universal-search") as HTMLInputElement | null;
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) {
        setter.call(input, name);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      input.focus();
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b bg-amber-500/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top Parts by Revenue
          </span>
        </div>
        <button
          onClick={() => setView("reports")}
          className="flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          Reports <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <ScrollArea className="max-h-56">
        {chartsQ.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground">No sales data yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {products.map((p: any, i: number) => {
              const maxRevenue = products[0]?.revenue || 1;
              const pct = Math.max(8, Math.round((p.revenue / maxRevenue) * 100));
              return (
                <button
                  key={i}
                  onClick={() => handleSearch(p.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted/50"
                >
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                    i === 0 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"
                  )}>
                    {i === 0 ? <Crown className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{p.qty} sold</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-amber-600">{formatCurrency(p.revenue)}</span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
