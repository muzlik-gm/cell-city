"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  Plus,
  Search,
  Package,
  Loader2,
  TrendingUp,
  Building2,
  ArrowRight,
  Info,
  X,
  PackageCheck,
  History,
} from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/format";
import { MOVEMENT_TYPES } from "@/lib/types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Brand { name: string }
interface Model { name: string }
interface PartType { name: string }
interface Warehouse { id: string; name: string; code: string }
interface User { id: string; name: string; email: string }
interface Product {
  id: string; sku: string; name: string; stock: number; minStock: number;
  brand?: Brand | null; model?: Model | null; partType?: PartType | null;
  warehouse?: Warehouse | null; shelf?: { code: string } | null;
}
interface Movement {
  id: string;
  productId: string;
  type: string;
  qty: number;
  ref?: string | null;
  note?: string | null;
  date: string;
  product?: Product | null;
  fromWarehouse?: Warehouse | null;
  toWarehouse?: Warehouse | null;
  user?: User | null;
}
interface MovementsResponse {
  data: Movement[];
  total: number;
  page: number;
  pageSize: number;
}
interface TransfersResponse extends MovementsResponse {
  stats?: { thisMonth: number; unitsMoved: number; activeWarehouses: number };
}

// ────────────────────────────────────────────────────────────────────────────
// Movement type badge — color-coded per design system (no indigo/blue)
//   TRANSFER=teal, IN=emerald, OUT=rose, SALE=rose, PURCHASE=emerald,
//   DAMAGE=amber, ADJUST=amber, REPAIR=purple
// ────────────────────────────────────────────────────────────────────────────
const MOVEMENT_TYPE_STYLE: Record<string, string> = {
  TRANSFER: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  IN: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  OUT: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  SALE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  PURCHASE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  DAMAGE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ADJUST: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  REPAIR: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

const MOVEMENT_TYPE_ICON: Record<string, string> = {
  TRANSFER: "Transfer",
  IN: "Stock In",
  OUT: "Stock Out",
  SALE: "Sale",
  PURCHASE: "Purchase",
  DAMAGE: "Damaged",
  ADJUST: "Adjust",
  REPAIR: "Repair",
};

function MovementTypeBadge({ type }: { type: string }) {
  const cls = MOVEMENT_TYPE_STYLE[type] ?? "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`font-medium ${cls}`}>
      {MOVEMENT_TYPE_ICON[type] ?? type}
    </Badge>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────
export function TransfersView() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  // We use the /api/movements endpoint for the unified history table because the
  // task asks the table to "combine transfers + all movements" (audit trail).
  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (typeFilter) p.set("type", typeFilter);
    if (dateFilter) {
      const d = new Date(dateFilter);
      const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
      p.set("from", from);
      p.set("to", to);
    }
    p.set("page", String(page));
    p.set("pageSize", "20");
    return p.toString();
  }, [typeFilter, dateFilter, page]);

  const movements = useQuery<MovementsResponse>({
    queryKey: ["movements", queryStr],
    queryFn: () => api.get(`/movements?${queryStr}`),
  });

  // Stats come from the transfers endpoint (this-month + units moved + active warehouses).
  const transfersStatsQuery = useQuery<TransfersResponse>({
    queryKey: ["transfers-stats"],
    queryFn: () => api.get(`/transfers?pageSize=1`),
    staleTime: 30_000,
  });

  const stats = transfersStatsQuery.data?.stats ?? {
    thisMonth: 0,
    unitsMoved: 0,
    activeWarehouses: 0,
  };

  const columns: Column<Movement & Record<string, unknown>>[] = [
    {
      key: "date",
      header: "Date",
      className: "min-w-[140px]",
      render: (m) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{formatDateTime(m.date)}</p>
          {m.ref && (
            <p className="font-mono text-[11px] text-muted-foreground">{m.ref}</p>
          )}
        </div>
      ),
    },
    {
      key: "product",
      header: "Product",
      className: "min-w-[220px]",
      render: (m) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{m.product?.name ?? "—"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {m.product?.sku ?? ""}
              {m.product?.brand?.name ? ` · ${m.product.brand.name}` : ""}
              {m.product?.model?.name ? ` ${m.product.model.name}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (m) => <MovementTypeBadge type={m.type} />,
    },
    {
      key: "route",
      header: "From → To",
      className: "min-w-[220px]",
      render: (m) => (
        <div className="flex items-center gap-1.5 text-xs">
          <div className="min-w-0 flex-1">
            {m.fromWarehouse ? (
              <div className="flex items-center gap-1.5">
                <span className="truncate rounded bg-rose-500/10 px-1.5 py-0.5 font-medium text-rose-600 dark:text-rose-400">
                  {m.fromWarehouse.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{m.fromWarehouse.code}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {m.toWarehouse ? (
              <div className="flex items-center gap-1.5">
                <span className="truncate rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                  {m.toWarehouse.name}
                </span>
                <span className="text-[10px] text-muted-foreground">{m.toWarehouse.code}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      className: "text-right",
      render: (m) => (
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatNumber(m.qty)}
        </span>
      ),
    },
    {
      key: "note",
      header: "Note",
      className: "min-w-[180px] max-w-[280px]",
      render: (m) => (
        <p className="truncate text-xs text-muted-foreground" title={m.note ?? ""}>
          {m.note ?? "—"}
        </p>
      ),
    },
    {
      key: "user",
      header: "User",
      className: "min-w-[120px]",
      render: (m) => (
        <span className="text-xs text-muted-foreground">{m.user?.name ?? "System"}</span>
      ),
    },
  ];

  const hasFilters = typeFilter || dateFilter;
  const clearFilters = () => {
    setTypeFilter("");
    setDateFilter("");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Warehouse Transfers"
        description="Move stock between warehouses and track movement history"
        icon={ArrowLeftRight}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Transfer
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Transfers This Month"
          value={formatNumber(stats.thisMonth)}
          icon={ArrowLeftRight}
          accent="teal"
          subtitle="Recorded this calendar month"
        />
        <StatCard
          label="Units Moved"
          value={formatNumber(stats.unitsMoved)}
          icon={TrendingUp}
          accent="emerald"
          subtitle="Total units transferred this month"
        />
        <StatCard
          label="Active Warehouses"
          value={formatNumber(stats.activeWarehouses)}
          icon={Building2}
          accent="purple"
          subtitle="Warehouses in transfer history"
        />
      </div>

      {/* Stock-tracking notice */}
      <div className="flex items-start gap-3 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3.5 text-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
          <Info className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Stock is tracked at the product level</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each product carries a single warehouse + shelf location and a stock count. A transfer
            records the movement for the audit trail below and, when the full stock moves, updates
            the product&rsquo;s bin location to the destination warehouse. Use this screen as your
            full inventory movement history.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2 text-sm font-medium text-muted-foreground">
            <History className="h-4 w-4" />
            <span>Movement History</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={typeFilter || "all"}
              onValueChange={(v) => {
                setTypeFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MOVEMENT_TYPE_ICON[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="w-[160px]"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={(movements.data?.data ?? []) as (Movement & Record<string, unknown>)[]}
        loading={movements.isLoading}
        pagination
        page={page}
        pageSize={20}
        total={movements.data?.total ?? 0}
        onPageChange={setPage}
        rowKey={(m) => m.id}
        emptyTitle="No movements found"
        emptyDescription={
          hasFilters
            ? "Try adjusting your filters."
            : "Record a transfer or make a sale/purchase to see movement history here."
        }
      />

      <TransferFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["movements"] });
          qc.invalidateQueries({ queryKey: ["transfers"] });
          qc.invalidateQueries({ queryKey: ["transfers-stats"] });
          qc.invalidateQueries({ queryKey: ["products"] });
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// New Transfer Dialog
// ────────────────────────────────────────────────────────────────────────────
function TransferFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  // Warehouses list — always fetched when dialog opens
  const warehouses = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => api.get("/warehouses"),
    enabled: open,
    staleTime: 60_000,
  });

  // Product search — debounced via the search state; query fires when length > 0
  const productSearch = useQuery<{ data: Product[] }>({
    queryKey: ["products-transfer", search],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(search)}&pageSize=10`),
    enabled: open && search.length > 0,
    staleTime: 10_000,
  });

  const resetForm = () => {
    setSearch("");
    setProductId("");
    setSelectedProduct(null);
    setFromWarehouseId("");
    setToWarehouseId("");
    setQty(1);
    setNote("");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) resetForm();
    onOpenChange(o);
  };

  // When a product is selected, auto-fill the "from" warehouse from the product's
  // current warehouse (if any). The user can still change it.
  const selectProduct = (p: Product) => {
    setProductId(p.id);
    setSelectedProduct(p);
    setFromWarehouseId(p.warehouse?.id ?? "");
    setSearch("");
  };

  const availableStock = selectedProduct?.stock ?? 0;
  const qtyNum = Math.max(0, Math.floor(Number(qty) || 0));
  const sameWarehouse = !!fromWarehouseId && fromWarehouseId === toWarehouseId;
  const canSubmit =
    !!productId &&
    !!fromWarehouseId &&
    !!toWarehouseId &&
    !sameWarehouse &&
    qtyNum > 0 &&
    qtyNum <= availableStock;

  const createTransfer = useMutation({
    mutationFn: () =>
      api.post<Movement>("/transfers", {
        productId,
        fromWarehouseId,
        toWarehouseId,
        qty: qtyNum,
        note: note.trim() || undefined,
      }),
    onSuccess: (m) => {
      toast.success(
        `Transfer ${m.ref ?? "created"} — ${qtyNum} × ${
          selectedProduct?.name ?? "item"
        } moved`
      );
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["transfers-stats"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" /> New Warehouse Transfer
          </DialogTitle>
          <DialogDescription>
            Move stock between warehouses. A movement record is created for the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-6">
          {/* Product search / select */}
          <div>
            <Label className="text-xs font-medium">Product</Label>
            {selectedProduct ? (
              <div className="mt-1 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selectedProduct.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selectedProduct.sku}
                    {selectedProduct.brand?.name ? ` · ${selectedProduct.brand.name}` : ""}
                    {selectedProduct.model?.name ? ` ${selectedProduct.model.name}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{selectedProduct.stock}</p>
                  <p className="text-[10px] text-muted-foreground">in stock</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProductId("");
                    setSelectedProduct(null);
                    setFromWarehouseId("");
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Clear product"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, SKU, brand or model…"
                    className="pl-9"
                  />
                </div>
                {search && (
                  <div className="mt-1.5 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-sm">
                    {productSearch.isLoading && (
                      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                      </div>
                    )}
                    {!productSearch.isLoading &&
                      (productSearch.data?.data ?? []).length === 0 && (
                        <div className="p-3 text-xs text-muted-foreground">
                          No products found.
                        </div>
                      )}
                    <AnimatePresence>
                      {(productSearch.data?.data ?? []).map((p) => (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          type="button"
                          onClick={() => selectProduct(p)}
                          className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent transition"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Package className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {p.sku}
                              {p.brand?.name ? ` · ${p.brand.name}` : ""}
                              {p.model?.name ? ` ${p.model.name}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{p.stock}</p>
                            <p className="text-[10px] text-muted-foreground">stock</p>
                          </div>
                          {p.warehouse && (
                            <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400">
                              {p.warehouse.code}
                            </span>
                          )}
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>

          {/* From / To warehouses */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium">From Warehouse</Label>
              <Select
                value={fromWarehouseId || "none"}
                onValueChange={(v) => setFromWarehouseId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Source warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select source —</SelectItem>
                  {(warehouses.data ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct?.warehouse && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Product&rsquo;s current warehouse: {selectedProduct.warehouse.name} (
                  {selectedProduct.warehouse.code})
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium">To Warehouse</Label>
              <Select
                value={toWarehouseId || "none"}
                onValueChange={(v) => setToWarehouseId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Destination warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select destination —</SelectItem>
                  {(warehouses.data ?? [])
                    .filter((w) => w.id !== fromWarehouseId)
                    .map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {sameWarehouse && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                  Source and destination must differ.
                </p>
              )}
            </div>
          </div>

          {/* Qty + available stock */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium">Quantity</Label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 0)}
                className="mt-1"
              />
              {qtyNum > availableStock && (
                <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                  Exceeds available stock ({availableStock}).
                </p>
              )}
            </div>
            <div className="flex flex-col justify-end">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <PackageCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Available stock</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatNumber(availableStock)}{" "}
                    <span className="text-[11px] font-normal text-muted-foreground">units</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <Label className="text-xs font-medium">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for this transfer (e.g. reason, batch id, driver)…"
              className="mt-1 min-h-[70px]"
            />
          </div>

          {/* Stock tracking reminder */}
          <div className="flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
            <p className="text-muted-foreground">
              Because stock is tracked at the product level, transferring records the movement for
              audit and — when the full stock is moved — updates the product&rsquo;s bin location to
              the destination warehouse.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={createTransfer.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => createTransfer.mutate()}
            disabled={!canSubmit || createTransfer.isPending}
            className="gap-1.5"
          >
            {createTransfer.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-4 w-4" />
            )}
            Create Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
