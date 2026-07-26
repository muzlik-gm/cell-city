"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, initials } from "@/lib/format";
import {
  Truck,
  X,
  Loader2,
  Phone,
  Building2,
  Package,
  ChevronRight,
} from "lucide-react";

/**
 * Supplier quick-search for the home hero.
 * Debounced (200ms) search of `/api/suppliers?q=`. Results appear in a
 * dropdown: avatar initials, name, phone, and products-supplied count.
 * Clicking a supplier reveals "Receive Stock" (→ Purchases) button.
 */
interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  _count?: { products: number; purchases: number };
}

export function SupplierQuickSearch() {
  const setView = useAppStore((s) => s.setView);
  const setContextId = useAppStore((s) => s.setContextId);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suppliersQ = useQuery({
    queryKey: ["suppliers-quick", debounced],
    queryFn: () => api.get<Supplier[]>(`/suppliers${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`),
    staleTime: 60_000,
  });

  const suppliers = (suppliersQ.data ?? []).slice(0, 8);
  const showResults = open && (query.length > 0);

  const handleSelect = (s: Supplier) => {
    setSelected(s);
    setOpen(false);
  };

  const handleReceiveStock = () => {
    if (selected) {
      setContextId(selected.id);
      setView("purchases");
    }
  };

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-2xl">
      <div className="relative">
        <Truck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setSelected(null); }}
          onFocus={() => setOpen(true)}
          placeholder="Find a supplier — name, phone, or company…"
          className="h-11 rounded-xl pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setSelected(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Selected supplier card */}
      {selected && (
        <Card className="mt-2 p-3 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials(selected.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {selected.company ?? "—"} · {selected._count?.products ?? 0} products supplied
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-8 gap-1.5 flex-1" onClick={handleReceiveStock}>
              <Package className="h-3.5 w-3.5" /> Receive Stock
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setView("purchases")}>
              View Purchases <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      )}

      {/* Dropdown results */}
      {showResults && !selected && (
        <Card className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden p-0 shadow-lg">
          {suppliersQ.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Building2 className="h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">No suppliers found</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/60"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initials(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {s.phone ?? "No phone"} · {s._count?.products ?? 0} products
                    </p>
                  </div>
                  {(s._count?.purchases ?? 0) > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600">
                      Active
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
