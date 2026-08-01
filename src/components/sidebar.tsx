"use client";

import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { hasPermission, RANK_LABELS } from "@/lib/auth-constants";
import type { ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Home, Package, ShoppingCart, Truck, Wrench, FileBarChart,
  Settings, Smartphone, ScanEye, Shield, LogOut,
} from "lucide-react";

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_NAV: NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "sales", label: "Sales", icon: ShoppingCart },
  { key: "purchases", label: "Purchases", icon: Truck },
  { key: "repairs", label: "Repairs", icon: Wrench },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "admin", label: "Admin Panel", icon: Shield },
  { key: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { view, setView, sidebarCollapsed, toggleSidebar } = useAppStore();
  const { user, logout } = useAuth();

  const rank = user?.type === "app_user" ? "app_user" : (user?.rank ?? "SALES_STAFF");
  const nav = ALL_NAV.filter((item) => hasPermission(rank, item.key));

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b px-4">
        <button onClick={() => setView("home")} className="flex items-center gap-2.5" aria-label="Cell City home">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-emerald text-white shadow-soft">
            <Smartphone className="h-5 w-5" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight">{user?.business?.name ?? "Cell City"}</span>
              <span className="text-[10px] text-muted-foreground">
                {user?.type === "app_user" ? "Owner" : RANK_LABELS[rank] ?? "Staff"}
              </span>
            </div>
          )}
        </button>
        <button onClick={toggleSidebar} className="ml-auto hidden rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:block" aria-label="Toggle sidebar">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-0.5">
          {nav.map((item) => {
            const active = view === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.97]",
                  active ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                  sidebarCollapsed && "justify-center"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* AI Camera + user footer */}
      {!sidebarCollapsed ? (
        <div className="space-y-1.5 border-t p-2.5">
          <button onClick={() => setView("home")} className="flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left shadow-soft transition-all hover:shadow-md active:scale-[0.98]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-emerald text-white">
              <ScanEye className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-xs font-semibold">AI Camera</div>
              <div className="text-[10px] text-muted-foreground">Identify any phone</div>
            </div>
          </button>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-muted-foreground transition-all hover:bg-destructive/5 hover:text-destructive active:scale-[0.98]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <LogOut className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-xs font-semibold">Sign Out</div>
              <div className="truncate text-[10px] text-muted-foreground">{user?.email ?? user?.username}</div>
            </div>
          </button>
        </div>
      ) : (
        <div className="border-t p-2.5">
          <button onClick={logout} className="flex w-full items-center justify-center rounded-xl p-2 text-muted-foreground transition-all hover:bg-destructive/5 hover:text-destructive active:scale-[0.95]" aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
