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
  Home,
  Package,
  ShoppingCart,
  Truck,
  Wrench,
  FileBarChart,
  Settings,
  Search,
  ScanEye,
  Plus,
  Camera,
} from "lucide-react";
import type { ViewKey } from "@/lib/types";

const NAV_ITEMS: { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }>; keywords?: string }[] = [
  { key: "home", label: "Home (Search)", icon: Home, keywords: "search find universal" },
  { key: "inventory", label: "Inventory", icon: Package, keywords: "stock parts" },
  { key: "sales", label: "Sales", icon: ShoppingCart, keywords: "sell pos invoice" },
  { key: "purchases", label: "Purchases", icon: Truck, keywords: "buy order stock receive" },
  { key: "repairs", label: "Repairs", icon: Wrench, keywords: "fix ticket repair" },
  { key: "reports", label: "Reports", icon: FileBarChart, keywords: "export pdf excel" },
  { key: "settings", label: "Settings", icon: Settings, keywords: "config theme" },
];

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setView } = useAppStore();

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Search or jump to… (e.g. A12, sales, settings)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="search home find parts universal"
            onSelect={() => { setView("home"); setCommandOpen(false); }}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span>Search Parts (Home)</span>
          </CommandItem>
          <CommandItem
            value="new sale sell invoice pos"
            onSelect={() => { setView("sales"); setCommandOpen(false); }}
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
            <span>New Sale</span>
          </CommandItem>
          <CommandItem
            value="receive stock inventory restock purchase"
            onSelect={() => { setView("purchases"); setCommandOpen(false); }}
          >
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span>Receive Stock</span>
          </CommandItem>
          <CommandItem
            value="camera identify phone lcd ai photo"
            onSelect={() => { setView("home"); setCommandOpen(false); }}
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span>Identify with Camera (AI)</span>
          </CommandItem>
          <CommandItem
            value="new repair ticket fix"
            onSelect={() => { setView("repairs"); setCommandOpen(false); }}
          >
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span>New Repair Ticket</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
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
      </CommandList>
    </CommandDialog>
  );
}
