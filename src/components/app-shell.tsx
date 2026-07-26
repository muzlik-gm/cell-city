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
        className={`hidden lg:flex flex-col shrink-0 border-r bg-sidebar transition-[width] duration-300 ${
          collapsed ? "w-[72px]" : "w-[256px]"
        }`}
      >
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <MobileNav />

      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <ViewRouter />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
