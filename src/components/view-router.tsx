"use client";

import { useAppStore } from "@/lib/store";
import { DashboardView } from "@/components/views/dashboard-view";
import { InventoryView } from "@/components/views/inventory-view";
import { ProductsView } from "@/components/views/products-view";
import { CompatibilityView } from "@/components/views/compatibility-view";
import { TransfersView } from "@/components/views/transfers-view";
import { SalesView } from "@/components/views/sales-view";
import { PurchasesView } from "@/components/views/purchases-view";
import { SuppliersView } from "@/components/views/suppliers-view";
import { CustomersView } from "@/components/views/customers-view";
import { PaymentsView } from "@/components/views/payments-view";
import { RepairsView } from "@/components/views/repairs-view";
import { AiView } from "@/components/views/ai-view";
import { ReportsView } from "@/components/views/reports-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { SettingsView } from "@/components/views/settings-view";
import { motion, AnimatePresence } from "framer-motion";

export function ViewRouter() {
  const view = useAppStore((s) => s.view);

  const views: Record<string, React.ReactNode> = {
    dashboard: <DashboardView />,
    inventory: <InventoryView />,
    products: <ProductsView />,
    compatibility: <CompatibilityView />,
    transfers: <TransfersView />,
    sales: <SalesView />,
    purchases: <PurchasesView />,
    suppliers: <SuppliersView />,
    customers: <CustomersView />,
    payments: <PaymentsView />,
    repairs: <RepairsView />,
    ai: <AiView />,
    reports: <ReportsView />,
    analytics: <AnalyticsView />,
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
        {views[view] ?? <DashboardView />}
      </motion.div>
    </AnimatePresence>
  );
}
