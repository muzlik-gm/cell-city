"use client";

import { useAppStore } from "@/lib/store";
import type { ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Shuffle,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Wallet,
  Wrench,
  ScanEye,
  FileBarChart,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Smartphone,
} from "lucide-react";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  badge?: string;
}

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { key: "inventory", label: "Inventory", icon: Package, group: "Catalog" },
  { key: "products", label: "Products", icon: Boxes, group: "Catalog" },
  { key: "compatibility", label: "Compatibility", icon: Shuffle, group: "Catalog" },
  { key: "transfers", label: "Transfers", icon: ArrowLeftRight, group: "Catalog" },
  { key: "ai", label: "AI Identification", icon: ScanEye, group: "Catalog" },
  { key: "sales", label: "Sales", icon: ShoppingCart, group: "Commerce" },
  { key: "purchases", label: "Purchases", icon: Truck, group: "Commerce" },
  { key: "suppliers", label: "Suppliers", icon: Users, group: "Commerce" },
  { key: "customers", label: "Customers", icon: UserCog, group: "Commerce" },
  { key: "payments", label: "Payments", icon: Wallet, group: "Commerce" },
  { key: "repairs", label: "Repair Jobs", icon: Wrench, group: "Service" },
  { key: "reports", label: "Reports", icon: FileBarChart, group: "Insights" },
  { key: "analytics", label: "Analytics", icon: BarChart3, group: "Insights" },
  { key: "settings", label: "Settings", icon: Settings, group: "System" },
];

export function Sidebar() {
  const { view, setView, sidebarCollapsed, toggleSidebar } = useAppStore();

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-emerald text-white shadow-soft">
          <Smartphone className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight">PartsHub</span>
            <span className="text-[10px] text-muted-foreground">Spare Parts OS</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto hidden rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:block"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((g) => (
          <div key={g} className="mb-3">
            {!sidebarCollapsed && (
              <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {g}
              </div>
            )}
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((item) => {
                const active = view === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => setView(item.key)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      sidebarCollapsed && "justify-center"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                    {!sidebarCollapsed && <span className="truncate min-w-0 flex-1 text-left">{item.label}</span>}
                    {!sidebarCollapsed && active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer card */}
      {!sidebarCollapsed && (
        <div className="border-t p-3">
          <div className="rounded-xl border bg-card p-3 shadow-soft">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ScanEye className="h-4 w-4" />
              </div>
              <div className="flex-1 leading-tight">
                <div className="text-xs font-semibold">AI Identify</div>
                <div className="text-[10px] text-muted-foreground">Snap a phone/LCD</div>
              </div>
            </div>
            <button
              onClick={() => setView("ai")}
              className="mt-2 w-full rounded-lg bg-primary/10 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20"
            >
              Open AI →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
