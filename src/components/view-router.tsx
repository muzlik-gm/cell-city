"use client";

import { useAppStore } from "@/lib/store";
import { HomeView } from "@/components/views/home-view";
import { InventoryView } from "@/components/views/inventory-view";
import { SalesView } from "@/components/views/sales-view";
import { PurchasesView } from "@/components/views/purchases-view";
import { RepairsView } from "@/components/views/repairs-view";
import { ReportsView } from "@/components/views/reports-view";
import { SettingsView } from "@/components/views/settings-view";
import { motion, AnimatePresence } from "framer-motion";

export function ViewRouter() {
  const view = useAppStore((s) => s.view);

  const views: Record<string, React.ReactNode> = {
    home: <HomeView />,
    inventory: <InventoryView />,
    sales: <SalesView />,
    purchases: <PurchasesView />,
    repairs: <RepairsView />,
    reports: <ReportsView />,
    settings: <SettingsView />,
  };

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
