"use client";

import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { hasPermission, RANK_LABELS } from "@/lib/auth-constants";
import type { ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Home, Package, ShoppingCart, Truck, Wrench, FileBarChart,
  Settings, Smartphone, ScanEye, Shield, LogOut,
  ChevronLeft, ChevronRight,
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
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4">
        <button 
          onClick={() => setView("home")} 
          className="flex items-center gap-3 group" 
          aria-label="Cell City home"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-elevated transition-transform group-hover:scale-105">
            <Smartphone className="h-5 w-5" />
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-background" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-none animate-slide-right">
              <span className="text-[15px] font-bold tracking-tight text-foreground">
                {user?.business?.name ?? "Cell City"}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {user?.type === "app_user" ? "Owner" : RANK_LABELS[rank] ?? "Staff"}
              </span>
            </div>
          )}
        </button>
        
        <button 
          onClick={toggleSidebar} 
          className={cn(
            "ml-auto hidden items-center justify-center rounded-lg p-2 text-muted-foreground transition-all hover:bg-accent hover:text-foreground lg:flex",
            sidebarCollapsed && "rotate-180"
          )}
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {nav.map((item, index) => {
            const active = view === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  "animate-in-up",
                  active
                    ? "bg-primary text-primary-foreground shadow-elevated"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  sidebarCollapsed && "justify-center px-2.5"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-foreground/30" />
                )}
                
                <Icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                  active && "drop-shadow-sm"
                )} />
                
                {!sidebarCollapsed && (
                  <span className="truncate font-medium">{item.label}</span>
                )}

                {/* Keyboard shortcut hints */}
                {!sidebarCollapsed && index < 7 && (
                  <kbd className="ml-auto hidden rounded-md bg-background/20 px-1.5 py-0.5 text-[9px] font-medium opacity-60 group-hover:opacity-100 xl:block">
                    {index + 1}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="border-t border-border/50 p-3 space-y-2">
        {!sidebarCollapsed ? (
          <>
            {/* AI Camera Button */}
            <button 
              onClick={() => setView("home")} 
              className="group flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-3 text-left transition-all hover:from-primary/15 hover:to-primary/10 hover:shadow-card"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary text-white shadow-soft transition-transform group-hover:scale-105">
                <ScanEye className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-xs font-semibold text-foreground">AI Camera</div>
                <div className="text-[10px] text-muted-foreground">Identify any phone model</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2.5 rounded-xl bg-card p-2.5 shadow-soft">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-soft">
                {user?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-xs font-semibold truncate">{user?.name ?? "User"}</div>
                <div className="truncate text-[10px] text-muted-foreground">{user?.email ?? user?.username}</div>
              </div>
              <button 
                onClick={logout}
                className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <button 
              onClick={() => setView("home")}
              className="flex w-full items-center justify-center rounded-xl p-2.5 text-primary hover:bg-primary/10 transition-colors"
              aria-label="AI Camera"
            >
              <ScanEye className="h-5 w-5" />
            </button>
            
            <div className="h-px bg-border/50 mx-2" />
            
            <button 
              onClick={logout} 
              className="flex w-full items-center justify-center rounded-xl p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


