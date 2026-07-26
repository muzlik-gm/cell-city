"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SmartProductCard } from "@/components/shared/smart-product-card";
import { ProductDetailSheet } from "@/components/shared/product-detail";
import { ProductFormDialog } from "@/components/shared/product-form";
import { StockAdjustDialog } from "@/components/shared/stock-adjust-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Search, X, AlertTriangle, Download } from "lucide-react";
import { downloadBlob, toCSV, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { useAppStore } from "@/lib/store";

interface Product {
  id: string; sku: string; name: string; quality: string; condition: string;
  stock: number; minStock: number; purchasePrice: number; sellingPrice: number;
  color?: string | null; barcode?: string | null; lcdCode?: string | null;
  brand?: { name: string } | null; model?: { name: string } | null;
  partType?: { name: string } | null; supplier?: { name: string } | null;
  warehouse?: { name: string } | null; shelf?: { code: string } | null;
  images?: { url: string }[];
}

export function InventoryView() {
  const qc = useQueryClient();
  const setView = useAppStore((s) => s.setView);
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState("");
  const [partTypeId, setPartTypeId] = useState("");
  const [stockFilter, setStockFilter] = useState(""); // "", "in", "out", "low"
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);

  const brands = useQuery({ queryKey: ["brands"], queryFn: () => api.get<any[]>("/brands") });
  const partTypes = useQuery({ queryKey: ["part-types"], queryFn: () => api.get<any[]>("/part-types") });

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (brandId) p.set("brandId", brandId);
    if (partTypeId) p.set("partTypeId", partTypeId);
    p.set("pageSize", "100");
    return p.toString();
  }, [q, brandId, partTypeId]);

  const products = useQuery<{ data: Product[]; total: number }>({
    queryKey: ["products", queryStr],
    queryFn: () => api.get(`/products?${queryStr}`),
  });

  // Client-side stock filter (in/out/low)
  const filtered = useMemo(() => {
    const list = products.data?.data ?? [];
    if (stockFilter === "in") return list.filter((p) => p.stock > p.minStock);
    if (stockFilter === "low") return list.filter((p) => p.stock > 0 && p.stock <= p.minStock);
    if (stockFilter === "out") return list.filter((p) => p.stock <= 0);
    return list;
  }, [products.data, stockFilter]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await api.del(`/products/${id}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exportCSV = () => {
    const rows = filtered.map((p) => ({
      SKU: p.sku, Name: p.name, Brand: p.brand?.name ?? "", Model: p.model?.name ?? "",
      Part: p.partType?.name ?? "", Quality: p.quality, Stock: p.stock, MinStock: p.minStock,
      Cost: p.purchasePrice, Price: p.sellingPrice, Shelf: p.shelf?.code ?? "",
    }));
    downloadBlob(toCSV(rows), `inventory-${Date.now()}.csv`, "text/csv");
    toast.success("CSV exported");
  };

  const hasFilters = q || brandId || partTypeId || stockFilter;
  const lowCount = (products.data?.data ?? []).filter((p) => p.stock <= p.minStock).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Inventory</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{products.data?.total ?? 0} products · {lowCount} low stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Search + simple filters */}
      <Card className="p-3 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, SKU, barcode, LCD code…"
              className="pl-9"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={brandId} onValueChange={(v) => setBrandId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="All brands" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {(brands.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={partTypeId} onValueChange={(v) => setPartTypeId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All parts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parts</SelectItem>
                {(partTypes.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Stock filter chips */}
        <div className="mt-2 flex gap-1.5">
          {[
            { key: "", label: "All" },
            { key: "in", label: "In Stock" },
            { key: "low", label: "Low Stock" },
            { key: "out", label: "Out of Stock" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStockFilter(f.key)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                stockFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f.label}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => { setQ(""); setBrandId(""); setPartTypeId(""); setStockFilter(""); }}
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </Card>

      {/* Product grid */}
      {products.isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[520px] animate-pulse rounded-2xl border bg-muted/50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={hasFilters ? "Try adjusting your filters." : "Add your first product to get started."}
          action={!hasFilters && <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-1.5"><Plus className="h-4 w-4" /> Add Product</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {filtered.map((p) => (
            <SmartProductCard
              key={p.id}
              product={p}
              onSell={() => { setView("sales"); }}
              onEdit={(prod) => { setEditing(prod); setFormOpen(true); }}
              onPrintQR={() => setSelected(p)}
              onHistory={() => setSelected(p)}
              onReceive={(prod) => setAdjustProduct(prod)}
            />
          ))}
        </div>
      )}

      <ProductDetailSheet product={selected} onOpenChange={(o) => !o && setSelected(null)} onEdit={(p) => { setSelected(null); setEditing(p); setFormOpen(true); }} />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <StockAdjustDialog product={adjustProduct} open={!!adjustProduct} onOpenChange={(o) => !o && setAdjustProduct(null)} />
    </div>
  );
}
