"use client";

import { useAppStore } from "@/lib/store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Package,
  Shuffle,
  Boxes,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Wrench,
  ScanEye,
  FileBarChart,
  BarChart3,
  Settings,
  Search,
  Smartphone,
} from "lucide-react";
import type { ViewKey } from "@/lib/types";

const NAV_ITEMS: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; keywords?: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { key: "inventory", label: "Inventory", icon: Package, keywords: "stock parts" },
  { key: "products", label: "Products", icon: Boxes, keywords: "catalog items" },
  { key: "compatibility", label: "Compatibility Engine", icon: Shuffle, keywords: "models fit" },
  { key: "ai", label: "AI Identification", icon: ScanEye, keywords: "identify photo scan" },
  { key: "sales", label: "Sales & Invoices", icon: ShoppingCart, keywords: "sell pos invoice" },
  { key: "purchases", label: "Purchases", icon: Truck, keywords: "buy order stock" },
  { key: "suppliers", label: "Suppliers", icon: Users, keywords: "vendor" },
  { key: "customers", label: "Customers", icon: UserCog, keywords: "client buyer" },
  { key: "repairs", label: "Repair Jobs", icon: Wrench, keywords: "fix ticket" },
  { key: "reports", label: "Reports", icon: FileBarChart, keywords: "export pdf excel" },
  { key: "analytics", label: "Analytics", icon: BarChart3, keywords: "charts trends" },
  { key: "settings", label: "Settings", icon: Settings, keywords: "config theme" },
];

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setView } = useAppStore();

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search or jump to… (e.g. A12 LCD, invoices, settings)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.key}
                value={`${item.label} ${item.keywords ?? ""}`}
                onSelect={() => {
                  setView(item.key);
                  setCommandOpen(false);
                }}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="new sale invoice"
            onSelect={() => {
              setView("sales");
              setCommandOpen(false);
            }}
          >
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span>Create New Sale</span>
          </CommandItem>
          <CommandItem
            value="add product inventory new"
            onSelect={() => {
              setView("inventory");
              setCommandOpen(false);
            }}
          >
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>Add Product to Inventory</span>
          </CommandItem>
          <CommandItem
            value="identify phone lcd ai photo"
            onSelect={() => {
              setView("ai");
              setCommandOpen(false);
            }}
          >
            <ScanEye className="h-4 w-4 text-muted-foreground" />
            <span>Identify Phone / LCD from Photo</span>
          </CommandItem>
          <CommandItem
            value="new repair ticket job"
            onSelect={() => {
              setView("repairs");
              setCommandOpen(false);
            }}
          >
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span>Create Repair Ticket</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
