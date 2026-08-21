"use client";

import { useAppStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { ViewRouter } from "@/components/view-router";
import { MobileNav } from "@/components/mobile-nav";

export function AppShell() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0 border-r border-border/40 
          bg-sidebar transition-all duration-300 ease-out
          ${collapsed ? "w-[80px]" : "w-[280px]"}
        `}
      >
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <MobileNav />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        
        <main className="flex-1 overflow-y-auto relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" />
          
          <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <ViewRouter />
          </div>
        </main>
      </div>

      {/* Command palette (Cmd+K) */}
      <CommandPalette />
    </div>
  );
}
