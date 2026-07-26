"use client";

import { useTheme } from "next-themes";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sun,
  Moon,
  Menu,
  Plus,
  Command as CommandIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NotificationsBell } from "@/components/shared/notifications-bell";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { setCommandOpen, setMobileNavOpen, setView, view } = useAppStore();
  const mounted = useMounted();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // low stock count for bell
  const lowStock = useQuery({
    queryKey: ["lowstock-count"],
    queryFn: () => api.get<{ count: number }>("/dashboard/low-stock-count"),
    staleTime: 60000,
  });

  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    products: "Products",
    compatibility: "Compatibility Engine",
    sales: "Sales & Invoices",
    purchases: "Purchases",
    suppliers: "Suppliers",
    customers: "Customers",
    repairs: "Repair Jobs",
    ai: "AI Identification",
    reports: "Reports",
    analytics: "Analytics",
    settings: "Settings",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden flex-col sm:flex">
        <h1 className="text-[15px] font-bold leading-tight tracking-tight">
          {titles[view] ?? "PartsHub"}
        </h1>
        <span className="text-[11px] text-muted-foreground">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Global search trigger */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group ml-2 flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-muted/50 pl-3 pr-2.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-muted lg:ml-6"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search products, models, invoices…</span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:flex">
          <CommandIcon className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          variant="default"
          className="hidden h-9 gap-1.5 rounded-lg shadow-soft sm:flex"
          onClick={() => setView("sales")}
        >
          <Plus className="h-4 w-4" />
          New Sale
        </Button>

        <NotificationsBell count={lowStock.data?.count ?? 0} mounted={mounted} />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </Button>

        <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-soft">
          SO
        </div>
      </div>
    </header>
  );
}
