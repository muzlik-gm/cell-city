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
import { CompatibilityResults } from "@/components/shared/compatibility-results";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Search, ScanEye, Package, Smartphone, Users, Truck, ShoppingCart,
  X, TrendingUp, ArrowRight, Sparkles, Camera, Clock, Flame,
  Zap, Target, Layers,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatCurrency, timeAgo } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";

const RECENT_KEY = "cellcity-recent-searches";
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

  // Popular models (top by product count)
  const popular = useQuery({
    queryKey: ["popular-models"],
    queryFn: () => api.get<any[]>("/models?popular=true"),
    staleTime: 120_000,
  });

  // Universal search
  const { data, isLoading } = useQuery({
    queryKey: ["universal-search", debounced],
    queryFn: () => api.get<any>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  // Compatibility-first search
  const compatQ = useQuery({
    queryKey: ["compatibility-search", debounced],
    queryFn: () => api.get<any>(`/compatibility-search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  const showCompatibility = compatQ.data?.partGroups?.length > 0;

  const hasResults = showCompatibility || (data && (
    (data.products?.length ?? 0) > 0 ||
    (data.compatibleProducts?.length ?? 0) > 0 ||
    (data.models?.length ?? 0) > 0 ||
    (data.brands?.length ?? 0) > 0 ||
    (data.customers?.length ?? 0) > 0 ||
    (data.suppliers?.length ?? 0) > 0 ||
    (data.sales?.length ?? 0) > 0
  ));

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

  // Keyboard navigation
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
    <div className="mx-auto max-w-7xl">
      {/* Hero Section — shown when no search */}
      <AnimatePresence mode="wait">
        {!debounced && (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center pt-4 sm:pt-8 pb-8"
          >
            {/* Today's KPI Summary */}
            <div className="mb-8 w-full">
              <TodaySummaryWidget />
            </div>

            {/* Hero text */}
            <div className="mb-8 text-center max-w-2xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 mb-6"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Universal Search</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">Find parts, models & compatibility in seconds</span>
              </motion.div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                What phone are you{" "}
                <span className="relative inline-block">
                  <span className="relative z-10 text-gradient">looking for?</span>
                  <svg className="absolute -bottom-1 left-0 w-full h-3 text-primary/20" viewBox="0 0 200 12" fill="none" preserveAspectRatio="none">
                    <path d="M2 10C40 4 160 4 198 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </span>
              </h1>
              
              <p className="mt-5 text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Search any phone model — we'll show you which parts fit and if we have them in stock right now.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar — always visible */}
      <div className={`relative ${!debounced ? "mx-auto max-w-3xl" : "mb-8"}`}>
        <div className={cn(
          "relative group",
          !debounced && "animate-scale-in"
        )}>
          <Search className={cn(
            "absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 transition-colors",
            "text-muted-foreground group-focus-within:text-primary"
          )} />
          
          <Input
            id="universal-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Samsung A12, LCD code, barcode, M12…"
            className={cn(
              "h-16 rounded-2xl pl-14 pr-14 text-base font-normal",
              "border-2 border-border/60 bg-card shadow-card",
              "focus-visible:border-primary focus-visible:shadow-elevated",
              "transition-all duration-200 placeholder:text-muted-foreground/70"
            )}
            autoComplete="off"
          />
          
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Hero actions — only when no search */}
        {!debounced && (
          <div className="mt-8 space-y-8">
            {/* AI Camera CTA */}
            <motion.div 
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-col items-center gap-4"
            >
              <Button
                size="lg"
                onClick={() => setAiOpen(true)}
                className={cn(
                  "h-13 gap-3 rounded-2xl px-8 text-base font-semibold",
                  "gradient-primary shadow-elevated",
                  "hover:shadow-card hover:scale-[1.02]",
                  "active:scale-[0.98] transition-all duration-200"
                )}
              >
                <Camera className="h-5 w-5" />
                Identify with AI Camera
                <Zap className="h-4 w-4 opacity-70" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Take a photo of a phone back or LCD connector for instant identification
              </p>
            </motion.div>

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="mx-auto max-w-2xl"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Recent Searches
                  </span>
                  <button 
                    onClick={clearRecent} 
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {recentSearches.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium",
                        "bg-card border border-border/60 shadow-soft",
                        "hover:border-primary/30 hover:bg-primary/5 hover:shadow-md",
                        "transition-all duration-200"
                      )}
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Popular models */}
            {popular.data && popular.data.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mx-auto max-w-3xl"
              >
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-chart-2" /> Trending Models
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {popular.data.slice(0, 10).map((m: any, i: number) => (
                    <motion.button
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.03 }}
                      onClick={() => { setQuery(m.name); inputRef.current?.focus(); }}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                        "bg-card border border-border/60 shadow-soft",
                        "hover:border-chart-2/30 hover:bg-chart-2/5 hover:shadow-md",
                        "transition-all duration-200"
                      )}
                    >
                      <Smartphone className="h-3.5 w-3.5 text-chart-2" />
                      {m.name}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Dashboard widgets grid */}
            <div className="grid w-full gap-5 lg:grid-cols-2">
              <LowStockWidget />
              <TopPartsWidget />
            </div>

            <div className="grid w-full gap-5 lg:grid-cols-2">
              <CustomerQuickSearch />
              <SupplierQuickSearch />
            </div>

            <RecentlySoldWidget />
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && debounced && (
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i} 
              className="h-[480px] rounded-2xl border border-border/40 bg-muted/20 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      )}

      {/* No results state */}
      {!isLoading && debounced && !hasResults && (
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 flex flex-col items-center text-center"
        >
          <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-5">
            <Package className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No results found</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            We couldn't find anything matching "<strong className="text-foreground">{debounced}</strong>". Try a different model name or LCD code.
          </p>
          <Button 
            variant="outline" 
            className="mt-5 rounded-xl"
            onClick={() => setQuery("")}
          >
            Clear search
          </Button>
        </motion.div>
      )}

      {/* Results section */}
      
      {/* Compatibility-first view */}
      {!isLoading && showCompatibility && compatQ.data && (
        <CompatibilityResults
          matchedModels={compatQ.data.matchedModels}
          compatibleModels={compatQ.data.compatibleModels}
          partGroups={compatQ.data.partGroups}
          onQuickSell={(p) => setQuickSellProduct(p)}
          onViewProduct={(p) => setSelected(p)}
        />
      )}

      {/* Universal search results fallback */}
      {!isLoading && hasResults && !showCompatibility && (
        <div className="mt-8 space-y-8">
          {/* Keyboard navigation hints */}
          {dedupedProducts.length > 0 && (
            <div className="flex items-center justify-end gap-4 text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] border border-border/50">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] border border-border/50">Enter</kbd>
                Open
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] border border-border/50">Esc</kbd>
                Clear
              </span>
            </div>
          )}

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2.5">
            {data.models?.map((m: any) => (
              <button
                key={m.id}
                onClick={() => setQuery(m.name)}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium shadow-soft hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                {m.name}
                <Badge variant="secondary" className="rounded-full bg-muted/50 text-[10px] font-semibold">
                  {m._count?.products ?? 0} parts
                </Badge>
              </button>
            ))}
            
            {data.brands?.map((b: any) => (
              <button
                key={b.id}
                onClick={() => setQuery(b.name)}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium shadow-soft hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <Layers className="h-3.5 w-3.5 text-chart-3" />
                {b.name}
                <Badge variant="secondary" className="rounded-full bg-muted/50 text-[10px] font-semibold">
                  {b._count?.products ?? 0} parts
                </Badge>
              </button>
            ))}

            {data.customers?.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setView("sales")}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium shadow-soft hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <Users className="h-3.5 w-3.5 text-primary" />
                {c.name}
              </button>
            ))}

            {data.suppliers?.map((s: any) => (
              <button
                key={s.id}
                onClick={() => setView("purchases")}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium shadow-soft hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <Truck className="h-3.5 w-3.5 text-chart-2" />
                {s.name}
              </button>
            ))}
          </div>

          {/* Cross-compatible models note */}
          {data.compatibleModels?.length > 0 && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Cross-compatible parts:</span>
                {data.compatibleModels.slice(0, 6).map((m: any, i: number) => (
                  <Badge key={i} variant="outline" className="rounded-full bg-background/80 font-medium">
                    {m.name}
                  </Badge>
                ))}
                {data.compatibleModels.length > 6 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    +{data.compatibleModels.length - 6} more models
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* Products grouped by part type */}
          {(() => {
            let globalIdx = -1;
            return sortedGroups.map(([partType, products]) => (
              <section key={partType}>
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">{partType}</h2>
                  <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums">
                    {products.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((p) => {
                    globalIdx++;
                    const idx = globalIdx;
                    return (
                      <div
                        key={p.id}
                        ref={idx === focusedCardIndex ? focusedCardRef : undefined}
                        className={cn(
                          "rounded-2xl transition-all duration-200",
                          idx === focusedCardIndex && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-elevated scale-[1.02]"
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
              </section>
            ));
          })()}

          {/* Related sales */}
          {data.sales?.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-bold tracking-tight text-foreground">Related Sales</h2>
              </div>
              
              <div className="space-y-2.5">
                {data.sales.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setView("sales")}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 text-left shadow-soft hover:shadow-card hover:border-primary/20 transition-all duration-200"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{s.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.customer?.name ?? "Walk-in"} · {timeAgo(s.createdAt)}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">{formatCurrency(s.total)}</span>
                      <ArrowRight className="ml-2 inline h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modals & Sheets */}
      <ProductDetailSheet 
        product={selected} 
        onOpenChange={(o) => !o && setSelected(null)} 
        onEdit={(p) => { setSelected(null); setEditing(p); setFormOpen(true); }} 
      />
      
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      
      <Dialog open={!!qrProduct} onOpenChange={(o) => !o && setQrProduct(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">QR Code — {qrProduct?.sku}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrProduct && <QrDisplay value={qrProduct.sku} size={200} />}
            <p className="text-sm font-semibold text-foreground">{qrProduct?.name}</p>
            <p className="text-xs text-muted-foreground text-center">
              {qrProduct?.shelf?.code} · {qrProduct?.warehouse?.name}
            </p>
            <Button onClick={() => window.print()} className="w-full rounded-xl">
              Print QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StockAdjustDialog product={adjustProduct} open={!!adjustProduct} onOpenChange={(o) => !o && setAdjustProduct(null)} />
      <AiCameraModal open={aiOpen} onOpenChange={setAiOpen} />
      <QuickSellModal product={quickSellProduct} open={!!quickSellProduct} onOpenChange={(o) => !o && setQuickSellProduct(null)} />
    </div>
  );
}
