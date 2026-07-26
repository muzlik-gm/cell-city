"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ShoppingBag, ChevronRight, Loader2, Receipt } from "lucide-react";
import { formatCurrency, timeAgo } from "@/lib/format";

/**
 * Recently Sold widget for the home hero.
 * Shows the last 5 sales with invoice no, customer, total, and time-ago.
 * Clicking a row navigates to the Sales view.
 */
export function RecentlySoldWidget() {
  const setView = useAppStore((s) => s.setView);

  const salesQ = useQuery({
    queryKey: ["home-recent-sales"],
    queryFn: () => api.get<{ data: any[]; total: number }>("/sales?pageSize=5"),
    staleTime: 30_000,
  });

  const sales = salesQ.data?.data ?? [];

  return (
    <Card className="overflow-hidden p-0 shadow-soft">
      <div className="flex items-center justify-between border-b bg-emerald-500/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <ShoppingBag className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recently Sold
          </span>
        </div>
        <button
          onClick={() => setView("sales")}
          className="flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <ScrollArea className="max-h-56">
        {salesQ.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Receipt className="h-5 w-5" />
            </div>
            <p className="mt-2 text-xs font-medium">No sales yet today</p>
            <p className="text-[11px] text-muted-foreground">Sales will appear here</p>
          </div>
        ) : (
          <div className="divide-y">
            {sales.map((sale: any) => (
              <button
                key={sale.id}
                onClick={() => setView("sales")}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{sale.invoiceNo}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {sale.customer?.name ?? "Walk-in"} · {timeAgo(sale.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(sale.total)}</p>
                  <Badge variant="outline" className="px-1 py-0 text-[9px]">
                    {sale.items?.length ?? 0} item{(sale.items?.length ?? 0) === 1 ? "" : "s"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
