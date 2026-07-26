"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SmartProductCard } from "@/components/shared/smart-product-card";
import { ProductDetailSheet } from "@/components/shared/product-detail";
import { ProductFormDialog } from "@/components/shared/product-form";
import { StockAdjustDialog } from "@/components/shared/stock-adjust-dialog";
import { QrDisplay } from "@/components/shared/qr-barcode";
import { AiCameraModal } from "@/components/shared/ai-camera-modal";
import { QuickSellModal } from "@/components/shared/quick-sell-modal";
import { LowStockWidget } from "@/components/shared/low-stock-widget";
import { TodaySummaryWidget } from "@/components/shared/today-summary-widget";
import { CustomerQuickSearch } from "@/components/shared/customer-quick-search";
import { SupplierQuickSearch } from "@/components/shared/supplier-quick-search";
import { RecentlySoldWidget } from "@/components/shared/recently-sold-widget";
import { TopPartsWidget } from "@/components/shared/top-parts-widget";
import { CollapsibleWidget } from "@/components/shared/collapsible-widget";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Search, ScanEye, Package, Smartphone, Users, Truck, ShoppingCart,
  X, TrendingUp, ArrowRight, Sparkles, Camera, Clock, Flame,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatCurrency, timeAgo } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";

const RECENT_KEY = "partshub-recent-searches";
const MAX_RECENT = 6;

export function HomeView() {
  const { setView } = useAppStore();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [qrProduct, setQrProduct] = useState<any>(null);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [quickSellProduct, setQuickSellProduct] = useState<any>(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedCardRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query); setFocusedCardIndex(-1); }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedCardIndex >= 0 && focusedCardRef.current) {
      focusedCardRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [focusedCardIndex]);

  const saveRecent = useCallback((q: string) => {
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
  }, []);

  // Popular models (top by product count) for the hero
  const popular = useQuery({
    queryKey: ["popular-models"],
    queryFn: () => api.get<any[]>("/models?popular=true"),
    staleTime: 120_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["universal-search", debounced],
    queryFn: () => api.get<any>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  const hasResults = data && (
    (data.products?.length ?? 0) > 0 ||
    (data.compatibleProducts?.length ?? 0) > 0 ||
    (data.models?.length ?? 0) > 0 ||
    (data.brands?.length ?? 0) > 0 ||
    (data.customers?.length ?? 0) > 0 ||
    (data.suppliers?.length ?? 0) > 0 ||
    (data.sales?.length ?? 0) > 0
  );

  const allProducts = data ? [...(data.products ?? []), ...(data.compatibleProducts ?? [])] : [];
  // Deduplicate by id
  const seen = new Set<string>();
  const dedupedProducts = allProducts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Group by part type
  const grouped: Record<string, any[]> = {};
  for (const p of dedupedProducts) {
    const key = p.partType?.name ?? "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  const partTypeOrder = ["LCD", "OLED", "AMOLED", "Touch Glass", "Battery", "Frame", "Charging Flex", "Power Flex", "Volume Flex", "Front Camera", "Camera", "Speaker", "Earpiece"];
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const ai = partTypeOrder.indexOf(a[0]);
    const bi = partTypeOrder.indexOf(b[0]);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const handleSell = useCallback((p: any) => {
    useAppStore.getState().setContextId(p.id);
    setView("sales");
  }, [setView]);

  // Esc clears search; Enter saves to recent / opens focused card; Arrow keys navigate cards
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        setFocusedCardIndex(-1);
      }
      if (e.key === "Enter" && debounced.length > 1) {
        if (focusedCardIndex >= 0 && focusedCardIndex < dedupedProducts.length) {
          e.preventDefault();
          setSelected(dedupedProducts[focusedCardIndex]);
        } else {
          saveRecent(debounced);
        }
      }
      if (hasResults && !isLoading) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedCardIndex((i) => Math.min(i + 1, dedupedProducts.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedCardIndex((i) => Math.max(i - 1, -1));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debounced, saveRecent, focusedCardIndex, hasResults, isLoading, dedupedProducts]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero search — only shown when no query */}
      <AnimatePresence mode="wait">
        {!debounced && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center pt-4 sm:pt-8"
          >
            {/* Today's business pulse — instant KPIs at the top of the hero */}
            <div className="mb-4 w-full">
              <TodaySummaryWidget />
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Search anything · finds parts, models, compatibility & more
            </div>
            <h1 className="mb-3 text-center text-4xl font-bold tracking-tight sm:text-5xl">
              Find any part in <span className="text-gradient">seconds</span>
            </h1>
            <p className="mb-10 max-w-lg text-center text-lg text-muted-foreground">
              Type a phone model, LCD code, barcode, or compatible phone. Results appear instantly.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar — always visible, large and centered */}
      <div className={`relative ${!debounced ? "mx-auto max-w-2xl" : "mb-6"}`}>
        <div className="relative">
          <Search className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="universal-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Samsung A12, LCD code, barcode, M12…"
            className="h-16 rounded-2xl border-2 pl-14 pr-14 text-lg shadow-card focus-visible:border-primary"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* AI Camera button + recent searches + popular models — only in hero mode */}
        {!debounced && (
          <div className="mt-5 space-y-5">
            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                className="h-12 gap-2 rounded-xl px-6 shadow-soft"
                onClick={() => setAiOpen(true)}
              >
                <Camera className="h-5 w-5" />
                Identify with Camera
              </Button>
              <p className="text-xs text-muted-foreground">Take a photo of a phone back or LCD connector</p>
            </div>

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Recent
                  </span>
                  <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {recentSearches.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                      className="rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Popular models */}
            {popular.data && popular.data.length > 0 && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-primary" /> Popular Models
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {popular.data.slice(0, 8).map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => { setQuery(m.name); inputRef.current?.focus(); }}
                      className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Smartphone className="h-3 w-3 text-primary" />
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Low-stock alerts + Top parts by revenue side by side on large screens */}
            <div className="grid w-full gap-4 sm:grid-cols-2">
              <LowStockWidget />
              <TopPartsWidget />
            </div>

            {/* Customer + Supplier quick-search side by side on large screens */}
            <div className="grid w-full gap-4 sm:grid-cols-2">
              <CustomerQuickSearch />
              <SupplierQuickSearch />
            </div>

            {/* Recently sold widget */}
            <RecentlySoldWidget />
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && debounced && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[520px] animate-pulse rounded-2xl border bg-muted/50" />
          ))}
        </div>
      )}

      {/* No results */}
      {!isLoading && debounced && !hasResults && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No results for "{debounced}"</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try a different model name, LCD code, or barcode.</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && hasResults && (
        <div className="mt-6 space-y-6">
          {/* Keyboard hint */}
          {dedupedProducts.length > 0 && (
            <div className="flex items-center justify-end gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">Esc</kbd>
                clear
              </span>
            </div>
          )}
          {/* Quick info chips: matched models, brands, customers, suppliers */}
          <div className="flex flex-wrap gap-2">
            {data.models?.map((m: any) => (
              <button
                key={m.id}
                onClick={() => setQuery(m.name)}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:border-primary/40"
              >
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                {m.name}
                <span className="text-muted-foreground">· {m._count?.products ?? 0} parts</span>
              </button>
            ))}
            {data.brands?.map((b: any) => (
              <button
                key={b.id}
                onClick={() => setQuery(b.name)}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:border-primary/40"
              >
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                {b.name}
                <span className="text-muted-foreground">· {b._count?.products ?? 0} parts</span>
              </button>
            ))}
            {data.customers?.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setView("sales")}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:border-primary/40"
              >
                <Users className="h-3.5 w-3.5 text-primary" />
                {c.name}
              </button>
            ))}
            {data.suppliers?.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setView("purchases")}
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-soft transition hover:border-primary/40"
              >
                <Truck className="h-3.5 w-3.5 text-primary" />
                {s.name}
              </button>
            ))}
          </div>

          {/* Compatible models note */}
          {data.compatibleModels?.length > 0 && (
            <Card className="border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-primary">Cross-compatible parts found:</span>
                {data.compatibleModels.slice(0, 6).map((m: any, i: number) => (
                  <Badge key={i} variant="outline" className="bg-card">
                    {m.name}
                  </Badge>
                ))}
                {data.compatibleModels.length > 6 && (
                  <span className="text-muted-foreground">+{data.compatibleModels.length - 6} more</span>
                )}
              </div>
            </Card>
          )}

          {/* Products grouped by part type */}
          {(() => {
            let globalIdx = -1;
            return sortedGroups.map(([partType, products]) => (
              <div key={partType}>
                <div className="mb-4 flex items-center gap-3">
                  <h3 className="text-xl font-bold tracking-tight">{partType}</h3>
                  <Badge variant="secondary" className="text-sm">{products.length}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {products.map((p) => {
                    globalIdx++;
                    const idx = globalIdx;
                    return (
                      <div
                        key={p.id}
                        ref={idx === focusedCardIndex ? focusedCardRef : undefined}
                        className={cn(
                          "rounded-2xl transition-all",
                          idx === focusedCardIndex && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]"
                        )}
                      >
                        <SmartProductCard
                          product={p}
                          onSell={handleSell}
                          onQuickSell={(prod) => setQuickSellProduct(prod)}
                          onEdit={(prod) => { setEditing(prod); setFormOpen(true); }}
                          onPrintQR={(prod) => setQrProduct(prod)}
                          onHistory={(prod) => setSelected(prod)}
                          onReceive={(prod) => setAdjustProduct(prod)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}

          {/* Recent sales matches */}
          {data.sales?.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xl font-bold tracking-tight">Related Sales</h3>
              </div>
              <div className="space-y-2">
                {data.sales.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setView("sales")}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-soft transition hover:shadow-md"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">{s.customer?.name ?? "Walk-in"} · {timeAgo(s.createdAt)}</p>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(s.total)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product detail sheet */}
      <ProductDetailSheet product={selected} onOpenChange={(o) => !o && setSelected(null)} onEdit={(p) => { setSelected(null); setEditing(p); setFormOpen(true); }} />
      {/* Edit form */}
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      {/* QR dialog */}
      <Dialog open={!!qrProduct} onOpenChange={(o) => !o && setQrProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code — {qrProduct?.sku}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            {qrProduct && <QrDisplay value={qrProduct.sku} size={200} />}
            <p className="text-center text-sm font-medium">{qrProduct?.name}</p>
            <p className="text-center text-xs text-muted-foreground">{qrProduct?.shelf?.code} · {qrProduct?.warehouse?.name}</p>
            <Button onClick={() => window.print()} className="mt-2 w-full">Print</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Stock adjust */}
      <StockAdjustDialog product={adjustProduct} open={!!adjustProduct} onOpenChange={(o) => !o && setAdjustProduct(null)} />
      {/* AI Camera modal */}
      <AiCameraModal open={aiOpen} onOpenChange={setAiOpen} />
      {/* Quick sell modal */}
      <QuickSellModal product={quickSellProduct} open={!!quickSellProduct} onOpenChange={(o) => !o && setQuickSellProduct(null)} />
    </div>
  );
}
