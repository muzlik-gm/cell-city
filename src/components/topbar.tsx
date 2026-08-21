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
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { setCommandOpen, setMobileNavOpen, setView, view } = useAppStore();
  const mounted = useMounted();
  const [now, setNow] = useState(new Date());
  const { user } = useAuth();
  
  const userInitials = user 
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() 
    : "?";
  const userTitle = user?.business?.name ?? "Cell City";

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Low stock count for notifications
  const lowStock = useQuery({
    queryKey: ["lowstock-count"],
    queryFn: () => api.get<{ count: number }>("/dashboard/low-stock-count"),
    staleTime: 60000,
  });

  const titles: Record<string, string> = {
    home: "Home",
    inventory: "Inventory",
    sales: "Sales",
    purchases: "Purchases",
    repairs: "Repairs",
    reports: "Reports",
    settings: "Settings",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileNavOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-accent hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title with date */}
      <div className="hidden flex-col sm:flex">
        <h1 className="text-[15px] font-bold tracking-tight text-foreground">
          {titles[view] ?? "Cell City"}
        </h1>
        <span className="text-[11px] font-medium text-muted-foreground">
          {now.toLocaleDateString("en-GB", { 
            weekday: "short", 
            day: "numeric", 
            month: "short" 
          })}
        </span>
      </div>

      {/* Global search — navigates to Home and focuses universal search */}
      <button
        onClick={() => { 
          setView("home"); 
          setTimeout(() => document.getElementById("universal-search")?.focus(), 100); 
        }}
        className={cn(
          "group ml-2 flex h-10 w-full max-w-lg items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 pl-4 pr-3.5 text-sm text-muted-foreground transition-all duration-200",
          "hover:border-primary/30 hover:bg-muted/50 hover:shadow-soft focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/20",
          "lg:ml-6"
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors" />
        <span className="flex-1 truncate text-left font-normal">Search anything…</span>
        <kbd className="hidden shrink-0 items-center gap-1 rounded-lg bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-soft border border-border/50 sm:flex group-hover:text-foreground transition-colors">
          <CommandIcon className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* New Sale button */}
        <Button
          size="sm"
          variant="default"
          className={cn(
            "hidden h-9.5 gap-2 rounded-xl px-4 font-medium shadow-soft transition-all duration-200",
            "hover:shadow-elevated active:scale-[0.97] sm:flex"
          )}
          onClick={() => setView("sales")}
        >
          <Plus className="h-4 w-4" />
          New Sale
        </Button>

        {/* Notifications */}
        <NotificationsBell count={lowStock.data?.count ?? 0} mounted={mounted} />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "relative flex h-9.5 w-9.5 items-center justify-center rounded-xl text-muted-foreground transition-all duration-300",
            "hover:bg-accent hover:text-foreground active:scale-95"
          )}
          aria-label="Toggle theme"
        >
          {mounted && (
            <>
              <Sun className={cn(
                "absolute h-4 w-4 transition-all duration-300",
                theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
              )} />
              <Moon className={cn(
                "absolute h-4 w-4 transition-all duration-300",
                theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
              )} />
            </>
          )}
        </button>

        {/* User avatar */}
        <button 
          className="group relative flex h-9.5 w-9.5 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-soft transition-all duration-200 hover:shadow-elevated hover:scale-105"
          title={`${user?.name ?? "User"} · ${userTitle}`}
        >
          {userInitials}
          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
        </button>
      </div>
    </header>
  );
}
