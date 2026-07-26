"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, AlertTriangle, Package, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { StockBadge } from "@/components/shared/badges";

interface NotificationsBellProps {
  count: number;
  mounted: boolean;
}

export function NotificationsBell({ count, mounted }: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const { setView } = useAppStore();

  const lowStock = useQuery({
    queryKey: ["notifications-lowstock"],
    queryFn: () => api.get<{ lowStock: any[] }>("/dashboard/latest"),
    enabled: open,
  });

  const items = lowStock.data?.lowStock ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {mounted && count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructiveforeground ring-2 ring-background">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
          </div>
          {count > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
              {count} low stock
            </Badge>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium">All stocked up</p>
              <p className="mt-0.5 text-xs text-muted-foreground">No low-stock alerts right now.</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setOpen(false);
                    setView("inventory");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/60"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.shelf?.code ?? "—"} · {p.warehouse?.code ?? "—"}
                    </p>
                  </div>
                  <StockBadge stock={p.stock} minStock={p.minStock} />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {items.length > 0 && (
          <button
            onClick={() => {
              setOpen(false);
              setView("inventory");
            }}
            className="flex w-full items-center justify-center gap-1 border-t px-4 py-2.5 text-xs font-semibold text-primary transition hover:bg-muted/60"
          >
            View all inventory <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
