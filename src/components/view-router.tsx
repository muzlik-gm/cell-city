"use client";

import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import { hasPermission } from "@/lib/auth-constants";
import { HomeView } from "@/components/views/home-view";
import { InventoryView } from "@/components/views/inventory-view";
import { SalesView } from "@/components/views/sales-view";
import { PurchasesView } from "@/components/views/purchases-view";
import { RepairsView } from "@/components/views/repairs-view";
import { ReportsView } from "@/components/views/reports-view";
import { SettingsView } from "@/components/views/settings-view";
import { AdminView } from "@/components/views/admin-view";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export function ViewRouter() {
  const view = useAppStore((s) => s.view);
  const { user } = useAuth();
  const rank = user?.type === "app_user" ? "app_user" : (user?.rank ?? "SALES_STAFF");

  const views: Record<string, React.ReactNode> = {
    home: <HomeView />,
    inventory: <InventoryView />,
    sales: <SalesView />,
    purchases: <PurchasesView />,
    repairs: <RepairsView />,
    reports: <ReportsView />,
    settings: <SettingsView />,
    admin: <AdminView />,
  };

  // Permission check — if user doesn't have access to this view, show denied
  if (!hasPermission(rank, view)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-xl font-bold">Access Denied</h3>
        <p className="mt-1 text-sm text-muted-foreground">Your rank ({rank.replace("_", " ").toLowerCase()}) doesn't have access to this page.</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {views[view] ?? <HomeView />}
      </motion.div>
    </AnimatePresence>
  );
}
