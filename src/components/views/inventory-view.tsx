"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ProductFormDialog } from "@/components/shared/product-form";
import { ProductDetailSheet } from "@/components/shared/product-detail";
import { QualityBadge, StockBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Filter, Download, AlertTriangle, X } from "lucide-react";
import { formatCurrency, downloadBlob, toCSV } from "@/lib/format";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { ScannerButton } from "@/components/shared/scanner-button";
import { QuickRestockButton } from "@/components/shared/quick-restock-button";

interface Product {
  id: string; sku: string; barcode: string | null; name: string;
  brand?: { name: string }; model?: { name: string }; partType?: { name: string };
  supplier?: { name: string }; warehouse?: { name: string }; shelf?: { code: string };
  quality: string; condition: string; color: string | null;
  purchasePrice: number; sellingPrice: number; stock: number; minStock: number;
  images?: { url: string }[];
}

export function InventoryView() {
  const qc = useQueryClient();
  const { setView } = useAppStore();
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState("");
  const [partTypeId, setPartTypeId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const brands = useQuery({ queryKey: ["brands"], queryFn: () => api.get<any[]>("/brands") });
  const partTypes = useQuery({ queryKey: ["part-types"], queryFn: () => api.get<any[]>("/part-types") });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: () => api.get<any[]>("/warehouses") });

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (brandId) p.set("brandId", brandId);
    if (partTypeId) p.set("partTypeId", partTypeId);
    if (warehouseId) p.set("warehouseId", warehouseId);
    if (lowOnly) p.set("lowStock", "true");
    p.set("page", String(page));
    p.set("pageSize", "20");
    return p.toString();
  }, [q, brandId, partTypeId, warehouseId, lowOnly, page]);

  const products = useQuery<{ data: Product[]; total: number }>({
    queryKey: ["products", queryStr],
    queryFn: () => api.get(`/products?${queryStr}`),
  });

  const onDelete = async (id: string) => {
    if (!confirm("Delete this product? This will hide it from inventory.")) return;
    try {
      await api.del(`/products/${id}`);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exportCSV = () => {
    const rows = (products.data?.data ?? []).map((p) => ({
      SKU: p.sku, Name: p.name, Brand: p.brand?.name ?? "", Model: p.model?.name ?? "",
      Part: p.partType?.name ?? "", Quality: p.quality, Stock: p.stock, MinStock: p.minStock,
      PurchasePrice: p.purchasePrice, SellingPrice: p.sellingPrice,
      Shelf: p.shelf?.code ?? "", Warehouse: p.warehouse?.name ?? "",
    }));
    downloadBlob(toCSV(rows), `inventory-${Date.now()}.csv`, "text/csv");
    toast.success("CSV exported");
  };

  // ── Scan handler — search by detected code & open detail if exactly one match ─
  const handleScanDetected = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const res = await api.get<{ data: Product[]; total: number }>(
        `/products?q=${encodeURIComponent(trimmed)}&pageSize=10`,
      );
      const matches = res?.data ?? [];
      if (matches.length === 1) {
        setDetail(matches[0]);
        toast.success(`Found "${matches[0].name}"`);
      } else if (matches.length > 1) {
        setQ(trimmed);
        setPage(1);
        toast.info(`${matches.length} products match code "${trimmed}" — see results below.`);
      } else {
        toast.error(`No product found for code "${trimmed}"`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "name", header: "Product", className: "min-w-[220px]",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {p.images?.[0]?.url ? (
              <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.sku}{p.lcdCode ? ` · ${p.lcdCode}` : ""}</p>
          </div>
        </div>
      ),
    },
    { key: "brand", header: "Brand", className: "min-w-[90px]", render: (p) => <span className="text-sm">{p.brand?.name ?? "—"}</span> },
    { key: "model", header: "Model", className: "min-w-[140px]", render: (p) => <span className="text-sm">{p.model?.name ?? "—"}</span> },
    { key: "partType", header: "Part", className: "min-w-[90px]", render: (p) => <Badge variant="secondary">{p.partType?.name ?? "—"}</Badge> },
    { key: "quality", header: "Quality", render: (p) => <QualityBadge quality={p.quality} /> },
    { key: "stock", header: "Stock", render: (p) => <StockBadge stock={p.stock} minStock={p.minStock} /> },
    { key: "location", header: "Location", className: "min-w-[120px] whitespace-nowrap", render: (p) => (
      <span className="text-xs text-muted-foreground whitespace-nowrap">{p.shelf?.code ?? "—"} · {p.warehouse?.name?.split(" ")[0] ?? "—"}</span>
    )},
    { key: "price", header: "Price", className: "text-right whitespace-nowrap", render: (p) => (
      <div className="text-right">
        <p className="text-sm font-semibold">{formatCurrency(p.sellingPrice)}</p>
        <p className="text-[11px] text-muted-foreground">cost {formatCurrency(p.purchasePrice)}</p>
      </div>
    )},
    { key: "actions", header: "", className: "text-right", render: (p) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); setDetail(p); }}>View</Button>
        <QuickRestockButton
          product={p}
          variant="outline"
          size="sm"
          label="Restock"
          className="h-8 px-2.5 text-xs"
          stopPropagation
        />
        <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); setEditing(p); setFormOpen(true); }}>Edit</Button>
        <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>Del</Button>
      </div>
    )},
  ];

  const hasFilters = q || brandId || partTypeId || warehouseId || lowOnly;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Manage your full spare parts catalog — LCDs, OLEDs, batteries, frames, flex and more"
        icon={Package}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Search by name, SKU, barcode, LCD code, model…"
                className="pl-9"
              />
            </div>
            <ScannerButton
              label="Scan"
              onDetected={handleScanDetected}
              className="shrink-0"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={brandId} onValueChange={(v) => { setBrandId(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All brands" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {(brands.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={partTypeId} onValueChange={(v) => { setPartTypeId(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All parts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All parts</SelectItem>
                {(partTypes.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All warehouses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All warehouses</SelectItem>
                {(warehouses.data ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={lowOnly ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => { setLowOnly(!lowOnly); setPage(1); }}
            >
              <AlertTriangle className="h-4 w-4" /> Low Stock
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setQ(""); setBrandId(""); setPartTypeId(""); setWarehouseId(""); setLowOnly(false); setPage(1); }}>
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={products.data?.data ?? []}
        loading={products.isLoading}
        pagination
        page={page}
        pageSize={20}
        total={products.data?.total ?? 0}
        onPageChange={setPage}
        onRowClick={(p) => setDetail(p)}
        rowKey={(p) => p.id}
        emptyTitle="No products found"
        emptyDescription={hasFilters ? "Try adjusting your filters." : "Add your first product to get started."}
      />

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <ProductDetailSheet product={detail} onOpenChange={(o) => !o && setDetail(null)} onEdit={(p) => { setDetail(null); setEditing(p); setFormOpen(true); }} />
    </div>
  );
}
