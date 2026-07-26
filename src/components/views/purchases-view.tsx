"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PaymentStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Truck, Plus, Search, Trash2, X, Eye, Package, Minus, Loader2, Building2,
  AlertCircle, Banknote, XCircle,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_STATUSES } from "@/lib/types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Supplier { id: string; name: string; company?: string | null; phone?: string | null; }
interface Product {
  id: string; sku: string; name: string; purchasePrice: number; sellingPrice: number;
  stock: number; brand?: { name: string } | null; model?: { name: string } | null;
}
interface PurchaseItem {
  id: string; productId: string; name: string; qty: number; cost: number; price: number; total: number;
  product?: { sku?: string; brand?: { name: string } | null; model?: { name: string } | null };
}
interface Purchase {
  id: string; poNo: string; supplierId?: string | null;
  supplier?: Supplier | null; user?: { name: string } | null;
  subtotal: number; discount: number; tax: number; total: number; paid: number;
  paymentStatus: string; status: string; notes?: string | null;
  createdAt: string; items: PurchaseItem[];
}
interface CartLine {
  key: string; productId: string; name: string; sku: string;
  qty: number; cost: number; currentCost: number; stock: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────────────────
export function PurchasesView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (paymentStatus) p.set("paymentStatus", paymentStatus);
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
  }, [q, paymentStatus, dateFilter, page]);

  const purchases = useQuery<{ data: Purchase[]; total: number }>({
    queryKey: ["purchases", queryStr],
    queryFn: () => api.get(`/purchases?${queryStr}`),
  });

  // Stats — fetch first 100 purchases + supplier count
  const statsQuery = useQuery<{ data: Purchase[] }>({
    queryKey: ["purchases-stats"],
    queryFn: () => api.get(`/purchases?pageSize=100`),
    staleTime: 30_000,
  });
  const suppliersCount = useQuery<{ length: number }>({
    queryKey: ["suppliers-count"],
    queryFn: async () => {
      const data = await api.get<Supplier[]>("/suppliers");
      return { length: data.length };
    },
    staleTime: 60_000,
  });
  const stats = useMemo(() => {
    const all = statsQuery.data?.data ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let monthTotal = 0, outstanding = 0;
    for (const p of all) {
      const t = new Date(p.createdAt).getTime();
      if (p.status !== "CANCELLED" && t >= monthStart) monthTotal += p.total;
      if (p.paymentStatus !== "PAID" && p.status !== "CANCELLED") outstanding += Math.max(0, p.total - p.paid);
    }
    return { monthTotal, outstanding, suppliersCount: suppliersCount.data?.length ?? 0 };
  }, [statsQuery.data, suppliersCount.data]);

  const columns: Column<Purchase & Record<string, unknown>>[] = [
    {
      key: "poNo", header: "PO No.", className: "min-w-[140px]",
      render: (p) => (
        <div>
          <p className="font-mono text-xs font-semibold text-foreground">{p.poNo}</p>
          <p className="text-[11px] text-muted-foreground">{formatDateTime(p.createdAt)}</p>
        </div>
      ),
    },
    {
      key: "supplier", header: "Supplier", className: "min-w-[170px]",
      render: (p) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.supplier?.name ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">{p.supplier?.phone ?? ""}</p>
          </div>
        </div>
      ),
    },
    {
      key: "items", header: "Items",
      render: (p) => <Badge variant="secondary" className="font-semibold">{p.items?.length ?? 0}</Badge>,
    },
    {
      key: "total", header: "Total", className: "text-right",
      render: (p) => (
        <div className="text-right">
          <p className="text-sm font-bold">{formatCurrency(p.total)}</p>
          <p className="text-[11px] text-muted-foreground">paid {formatCurrency(p.paid)}</p>
        </div>
      ),
    },
    {
      key: "paymentStatus", header: "Payment",
      render: (p) => <PaymentStatusBadge status={p.paymentStatus} />,
    },
    {
      key: "status", header: "Status",
      render: (p) => {
        if (p.status === "CANCELLED") return <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400">Cancelled</Badge>;
        if (p.status === "PENDING") return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Pending</Badge>;
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Received</Badge>;
      },
    },
    {
      key: "actions", header: "", className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={(e) => { e.stopPropagation(); openDetail(p.id); }}>
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
        </div>
      ),
    },
  ];

  const openDetail = async (id: string) => {
    try {
      const p = await api.get<Purchase>(`/purchases/${id}`);
      setDetailPurchase(p);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const hasFilters = q || paymentStatus || dateFilter;
  const clearFilters = () => { setQ(""); setPaymentStatus(""); setDateFilter(""); setPage(1); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchases"
        description="Record stock purchases, track supplier payments and update product costs"
        icon={Truck}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Purchase
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="This Month" value={formatCurrency(stats.monthTotal)} icon={Truck} accent="emerald" subtitle="Total purchases this month" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} icon={AlertCircle} accent="amber" subtitle="Unpaid purchase orders" />
        <StatCard label="Suppliers" value={stats.suppliersCount} icon={Building2} accent="purple" subtitle="Active suppliers" />
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search PO no, supplier name or notes…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={paymentStatus || "all"} onValueChange={(v) => { setPaymentStatus(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All payments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="w-[150px]"
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
        data={purchases.data?.data ?? []}
        loading={purchases.isLoading}
        pagination
        page={page}
        pageSize={20}
        total={purchases.data?.total ?? 0}
        onPageChange={setPage}
        onRowClick={(p) => openDetail(p.id)}
        rowKey={(p) => p.id}
        emptyTitle="No purchases found"
        emptyDescription={hasFilters ? "Try adjusting your filters." : "Record your first purchase order to get started."}
      />

      <PurchaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["purchases"] });
          qc.invalidateQueries({ queryKey: ["products"] });
        }}
      />

      <PurchaseDetailSheet purchase={detailPurchase} onOpenChange={(o) => !o && setDetailPurchase(null)} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Purchase Form Dialog
// ────────────────────────────────────────────────────────────────────────────
function PurchaseFormDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [notes, setNotes] = useState("");

  const suppliers = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers"),
    staleTime: 60_000,
  });

  const productSearch = useQuery<{ data: Product[] }>({
    queryKey: ["products-purchase", search],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(search)}&pageSize=10`),
    enabled: open && search.length > 0,
    staleTime: 10_000,
  });

  const resetForm = () => {
    setSupplierId(""); setCart([]); setSearch(""); setDiscount(0);
    setTax(0); setPaymentStatus("UNPAID"); setNotes("");
  };
  const handleOpenChange = (o: boolean) => {
    if (!o) resetForm();
    onOpenChange(o);
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.qty * l.cost, 0);
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, total };
  }, [cart, discount, tax]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, {
        key: p.id, productId: p.id, name: p.name, sku: p.sku,
        qty: 1, cost: p.purchasePrice, currentCost: p.purchasePrice, stock: p.stock,
      }];
    });
    setSearch("");
  };

  const updateLine = (key: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  };
  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const createPurchase = useMutation({
    mutationFn: () => api.post<Purchase>("/purchases", {
      supplierId: supplierId || undefined,
      items: cart.map((l) => ({ productId: l.productId, qty: l.qty, cost: l.cost })),
      discount, tax, paymentStatus, notes,
    }),
    onSuccess: (p) => {
      toast.success(`Purchase ${p.poNo} created — stock added`);
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = cart.length > 0 && !createPurchase.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> New Purchase Order
          </DialogTitle>
          <DialogDescription>Record stock received from a supplier. Stock levels and product costs are updated automatically.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] overflow-hidden">
          {/* Left: product search + cart */}
          <div className="flex flex-col overflow-hidden border-r">
            {/* Supplier + Search */}
            <div className="space-y-3 p-4 border-b">
              <div>
                <Label className="text-xs font-medium">Supplier</Label>
                <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No supplier —</SelectItem>
                    {(suppliers.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.company ? ` · ${s.company}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products to add to purchase…"
                  className="pl-9"
                />
              </div>
              {search && (
                <div className="max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-sm">
                  {productSearch.isLoading && (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                    </div>
                  )}
                  {!productSearch.isLoading && (productSearch.data?.data ?? []).length === 0 && (
                    <div className="p-3 text-xs text-muted-foreground">No products found.</div>
                  )}
                  <AnimatePresence>
                    {(productSearch.data?.data ?? []).map((p) => (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => addToCart(p)}
                        className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent transition"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.sku} · {p.brand?.name ?? ""} {p.model?.name ?? ""} · stock {p.stock}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatCurrency(p.purchasePrice)}</p>
                          <p className="text-[11px] text-muted-foreground">last cost</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="flex-1 overflow-hidden">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Truck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">No items yet</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Search products above to add them to this purchase.</p>
                </div>
              ) : (
                <ScrollArea className="h-full max-h-[42vh]">
                  <div className="space-y-2 p-3">
                    <AnimatePresence initial={false}>
                      {cart.map((l) => (
                        <motion.div
                          key={l.key}
                          layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="rounded-lg border bg-card p-3"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{l.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {l.sku} · current stock {l.stock} · prev cost {formatCurrency(l.currentCost)}
                              </p>
                            </div>
                            <button
                              onClick={() => removeLine(l.key)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="outline" className="h-7 w-7" type="button"
                                  onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number" min={1}
                                  value={l.qty}
                                  onChange={(e) => updateLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                                  className="h-7 px-2 text-center"
                                />
                                <Button size="icon" variant="outline" className="h-7 w-7" type="button"
                                  onClick={() => updateLine(l.key, { qty: l.qty + 1 })}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase text-muted-foreground">Unit Cost</Label>
                              <Input
                                type="number" min={0} step="any"
                                value={l.cost}
                                onChange={(e) => updateLine(l.key, { cost: Math.max(0, Number(e.target.value) || 0) })}
                                className="h-7 px-2"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                              <p className="flex h-7 items-center text-sm font-bold">
                                {formatCurrency(l.qty * l.cost)}
                              </p>
                            </div>
                          </div>
                          {l.cost !== l.currentCost && (
                            <p className="mt-1 text-[11px] text-amber-600">
                              ⚠ Cost change: was {formatCurrency(l.currentCost)} → now {formatCurrency(l.cost)}
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* Right: checkout */}
          <div className="flex flex-col overflow-hidden bg-muted/20">
            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="space-y-4 p-4">
                <div>
                  <Label className="text-xs font-medium">Payment Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium">Discount</Label>
                    <Input type="number" min={0} step="any" value={discount}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Tax</Label>
                    <Input type="number" min={0} step="any" value={tax}
                      onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium">Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Optional purchase notes…" className="mt-1 resize-none" />
                </div>
              </div>
            </ScrollArea>

            <div className="border-t bg-background p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Discount</span>
                  <span>− {formatCurrency(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">+ {formatCurrency(tax)}</span>
                </div>
              )}
              <div className="my-1 border-t" />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</span>
              </div>
              <Button
                className="mt-2 w-full gap-1.5" size="lg"
                disabled={!canSubmit}
                onClick={() => createPurchase.mutate()}
              >
                {createPurchase.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                {createPurchase.isPending ? "Saving…" : "Save Purchase"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Purchase Detail Sheet
// ────────────────────────────────────────────────────────────────────────────
function PurchaseDetailSheet({
  purchase, onOpenChange,
}: {
  purchase: Purchase | null;
  onOpenChange: (o: boolean) => void;
}) {
  const open = !!purchase;
  const qc = useQueryClient();

  const handleCancel = async () => {
    if (!purchase) return;
    if (!confirm(`Cancel purchase ${purchase.poNo}? Stock will be reversed if currently received.`)) return;
    try {
      await api.put(`/purchases/${purchase.id}`, { status: "CANCELLED" });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Purchase ${purchase.poNo} cancelled.`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleMarkPaid = async () => {
    if (!purchase) return;
    try {
      await api.put(`/purchases/${purchase.id}`, { paymentStatus: "PAID", paid: purchase.total });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(`Marked ${purchase.poNo} as paid.`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {purchase && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-base flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> {purchase.poNo}
                  </SheetTitle>
                  <SheetDescription>{formatDateTime(purchase.createdAt)}</SheetDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {purchase.status === "CANCELLED" ? (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400">Cancelled</Badge>
                  ) : purchase.status === "PENDING" ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Pending</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Received</Badge>
                  )}
                  <PaymentStatusBadge status={purchase.paymentStatus} />
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-100px)]">
              <div className="space-y-5 px-6 py-5">
                {/* Supplier info */}
                <div className="rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{purchase.supplier?.name ?? "—"}</p>
                      {purchase.supplier?.company && <p className="text-xs text-muted-foreground">{purchase.supplier.company}</p>}
                      {purchase.supplier?.phone && <p className="text-xs text-muted-foreground">{purchase.supplier.phone}</p>}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Items Received</h4>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Item</th>
                          <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">Qty</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Cost</th>
                          <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchase.items.map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="px-3 py-2">
                              <p className="font-medium">{it.name}</p>
                              <p className="text-[11px] text-muted-foreground">{it.product?.sku ?? ""}</p>
                            </td>
                            <td className="px-3 py-2 text-center">{it.qty}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(it.cost)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                  <Row label="Subtotal" value={formatCurrency(purchase.subtotal)} />
                  {purchase.discount > 0 && <Row label="Discount" value={`− ${formatCurrency(purchase.discount)}`} muted />}
                  {purchase.tax > 0 && <Row label="Tax" value={`+ ${formatCurrency(purchase.tax)}`} />}
                  <div className="my-1 border-t" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(purchase.total)}</span>
                  </div>
                  {purchase.paid > 0 && <Row label="Paid" value={formatCurrency(purchase.paid)} />}
                  {purchase.total - purchase.paid > 0 && (
                    <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-400">
                      <span className="text-xs font-medium">Balance Due</span>
                      <span className="font-semibold">{formatCurrency(purchase.total - purchase.paid)}</span>
                    </div>
                  )}
                </div>

                {purchase.notes && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase text-amber-600">Notes</p>
                    <p className="text-sm">{purchase.notes}</p>
                  </div>
                )}

                {purchase.user && (
                  <p className="text-center text-[11px] text-muted-foreground">Recorded by {purchase.user.name}</p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  {purchase.paymentStatus !== "PAID" && purchase.status !== "CANCELLED" && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkPaid}>
                      <Banknote className="h-4 w-4" /> Mark as Paid
                    </Button>
                  )}
                  {purchase.status !== "CANCELLED" && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-rose-600" onClick={handleCancel}>
                      <XCircle className="h-4 w-4" /> Cancel Purchase
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-amber-600" : "text-muted-foreground"}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
