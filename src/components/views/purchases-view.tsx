"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentStatusBadge } from "@/components/shared/badges";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Truck, Plus, Search, Trash2, X, Package, Minus, Loader2, Building2,
  AlertCircle, Banknote, XCircle, PackagePlus,
} from "lucide-react";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYMENT_STATUSES } from "@/lib/types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string; name: string; company?: string | null;
  phone?: string | null;
}
interface Product {
  id: string; sku: string; name: string;
  purchasePrice: number; sellingPrice: number; stock: number;
  brand?: { name: string } | null; model?: { name: string } | null;
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
interface ReceiveLine {
  key: string; productId: string; name: string; sku: string;
  qty: number; cost: number; currentCost: number; stock: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Main view — single-screen receive flow
// ────────────────────────────────────────────────────────────────────────────
export function PurchasesView() {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [receiveList, setReceiveList] = useState<ReceiveLine[]>([]);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [notes, setNotes] = useState("");
  const [detailPurchase, setDetailPurchase] = useState<Purchase | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const suppliers = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers"),
    staleTime: 60_000,
  });

  const productSearch = useQuery<{ data: Product[] }>({
    queryKey: ["products-receive", search],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(search)}&pageSize=10`),
    enabled: search.length > 0,
    staleTime: 10_000,
  });

  // Recent purchases — top 5 for the compact list
  const recentPurchasesQuery = useQuery<{ data: Purchase[] }>({
    queryKey: ["purchases-recent"],
    queryFn: () => api.get(`/purchases?pageSize=5`),
    staleTime: 15_000,
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
    let monthTotal = 0, outstanding = 0, monthCount = 0;
    for (const p of all) {
      const t = new Date(p.createdAt).getTime();
      if (p.status !== "CANCELLED" && t >= monthStart) {
        monthTotal += p.total;
        monthCount++;
      }
      if (p.paymentStatus !== "PAID" && p.status !== "CANCELLED") outstanding += Math.max(0, p.total - p.paid);
    }
    return { monthTotal, monthCount, outstanding, suppliersCount: suppliersCount.data?.length ?? 0 };
  }, [statsQuery.data, suppliersCount.data]);

  const totals = useMemo(() => {
    const subtotal = receiveList.reduce((s, l) => s + l.qty * l.cost, 0);
    const total = Math.max(0, subtotal - discount + tax);
    return { subtotal, total };
  }, [receiveList, discount, tax]);

  const addToList = (p: Product) => {
    setReceiveList((prev) => {
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

  const updateLine = (key: string, patch: Partial<ReceiveLine>) => {
    setReceiveList((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  };
  const removeLine = (key: string) => setReceiveList((prev) => prev.filter((l) => l.key !== key));
  const clearAll = () => {
    setReceiveList([]);
    setSupplierId("");
    setDiscount(0);
    setTax(0);
    setPaymentStatus("UNPAID");
    setNotes("");
  };

  const createPurchase = useMutation({
    mutationFn: () => api.post<Purchase>("/purchases", {
      supplierId: supplierId || undefined,
      items: receiveList.map((l) => ({ productId: l.productId, qty: l.qty, cost: l.cost })),
      discount, tax, paymentStatus, notes,
    }),
    onSuccess: (p) => {
      toast.success(`Stock received · ${p.poNo} · ${formatCurrency(p.total)}`);
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      clearAll();
      setShowCheckout(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = receiveList.length > 0 && !createPurchase.isPending &&
    receiveList.every((l) => l.qty > 0 && l.cost >= 0);

  const openDetail = async (id: string) => {
    try {
      const p = await api.get<Purchase>(`/purchases/${id}`);
      setDetailPurchase(p);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Receive Stock"
        description="Search · add to receiving list · pick supplier · save — all on one screen"
        icon={Truck}
      />

      {/* Compact KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="This Month" value={formatCurrency(stats.monthTotal)} icon={Truck} accent="emerald" subtitle={`${stats.monthCount} purchases`} />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} icon={AlertCircle} accent="amber" subtitle="Unpaid orders" />
        <StatCard label="Suppliers" value={stats.suppliersCount} icon={Building2} accent="purple" subtitle="Active" />
        <StatCard label="Receiving" value={receiveList.length} icon={PackagePlus} accent="teal" subtitle={`${receiveList.reduce((s, l) => s + l.qty, 0)} units`} />
      </div>

      {/* Receive — single screen */}
      <Card className="overflow-hidden p-0 shadow-soft">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
          {/* LEFT: search + receiving list */}
          <div className="flex flex-col border-b lg:border-b-0 lg:border-r">
            {/* Search bar */}
            <div className="border-b p-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by name, SKU, barcode…"
                  className="h-11 pl-9 text-base"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Search results dropdown */}
              {search && (
                <div className="max-h-72 overflow-y-auto rounded-lg border bg-popover shadow-sm">
                  {productSearch.isLoading && (
                    <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                    </div>
                  )}
                  {!productSearch.isLoading && (productSearch.data?.data ?? []).length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No products match <span className="font-medium">"{search}"</span>
                    </div>
                  )}
                  <AnimatePresence>
                    {(productSearch.data?.data ?? []).map((p) => (
                      <motion.button
                        key={p.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => addToList(p)}
                        className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent transition"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                        <Plus className="h-4 w-4 text-primary" />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Receiving list header */}
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="h-4 w-4 text-primary" />
                Receiving List
                {receiveList.length > 0 && (
                  <Badge variant="secondary" className="font-semibold">{receiveList.length}</Badge>
                )}
              </h3>
              {receiveList.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={clearAll}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>

            {/* Receiving list body */}
            <div className="flex-1 overflow-hidden">
              {receiveList.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No items to receive"
                  description="Search products above and click to add them to the receiving list."
                  className="py-10"
                />
              ) : (
                <ScrollArea className="max-h-[460px]">
                  <div className="space-y-2 p-3">
                    <AnimatePresence initial={false}>
                      {receiveList.map((l) => (
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
                              className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove from list"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                            {/* Qty stepper */}
                            <div className="col-span-2 sm:col-span-1">
                              <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                              <div className="mt-0.5 flex items-center gap-1">
                                <Button size="icon" variant="outline" className="h-8 w-8" type="button"
                                  onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number" min={1}
                                  value={l.qty}
                                  onChange={(e) => updateLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })}
                                  className="h-8 w-16 px-2 text-center"
                                />
                                <Button size="icon" variant="outline" className="h-8 w-8" type="button"
                                  onClick={() => updateLine(l.key, { qty: l.qty + 1 })}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {/* Unit cost */}
                            <div>
                              <Label className="text-[10px] uppercase text-muted-foreground">Unit Cost</Label>
                              <Input
                                type="number" min={0} step="any"
                                value={l.cost}
                                onChange={(e) => updateLine(l.key, { cost: Math.max(0, Number(e.target.value) || 0) })}
                                className="mt-0.5 h-8 px-2"
                              />
                            </div>
                            {/* Line total */}
                            <div className="text-right">
                              <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                              <p className="mt-0.5 flex h-8 items-center justify-end text-sm font-bold text-foreground tabular-nums">
                                {formatCurrency(l.qty * l.cost)}
                              </p>
                            </div>
                          </div>
                          {l.cost !== l.currentCost && (
                            <p className="mt-1 text-[11px] font-medium text-amber-600">
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

            {/* Mobile checkout trigger */}
            {receiveList.length > 0 && (
              <div className="border-t p-3 lg:hidden">
                <Button
                  className="h-12 w-full gap-2 text-base"
                  onClick={() => setShowCheckout(true)}
                >
                  <Truck className="h-5 w-5" />
                  Receive Stock · {formatCurrency(totals.total)}
                </Button>
              </div>
            )}
          </div>

          {/* RIGHT: supplier + checkout panel */}
          <div
            className={cn(
              "flex flex-col bg-muted/20",
              "lg:static lg:translate-x-0 lg:flex",
              "fixed inset-0 top-auto z-40 max-h-[92vh] translate-y-full transition-transform duration-300 lg:max-h-none",
              showCheckout && "translate-y-0",
            )}
          >
            {/* Mobile drag bar + close */}
            <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="h-4 w-4 text-primary" /> Receive Stock
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCheckout(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 lg:max-h-[520px]">
              <div className="space-y-4 p-4">
                {/* Supplier — big, prominent */}
                <div>
                  <Label className="text-xs font-medium">Supplier</Label>
                  <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                    <SelectTrigger className="mt-1 h-12 w-full text-base">
                      <SelectValue placeholder="Select supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No supplier —</SelectItem>
                      {(suppliers.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.company ? ` · ${s.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment status */}
                <div>
                  <Label className="text-xs font-medium">Payment Status</Label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {PAYMENT_STATUSES.map((s) => {
                      const active = paymentStatus === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPaymentStatus(s)}
                          className={cn(
                            "rounded-md border px-2 py-2 text-xs font-medium capitalize transition",
                            active
                              ? s === "PAID" ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : s === "PARTIAL" ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {s.toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Discount + Tax */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium">Discount</Label>
                    <Input type="number" min={0} step="any" value={discount || ""}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0" className="mt-1 h-10" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Tax</Label>
                    <Input type="number" min={0} step="any" value={tax || ""}
                      onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0" className="mt-1 h-10" />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs font-medium">Notes <span className="text-muted-foreground">(optional)</span></Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={2} placeholder="Purchase notes…" className="mt-1 resize-none" />
                </div>
              </div>
            </ScrollArea>

            {/* Totals + submit */}
            <div className="border-t bg-background p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Discount</span>
                  <span className="tabular-nums">− {formatCurrency(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium tabular-nums">+ {formatCurrency(tax)}</span>
                </div>
              )}
              <div className="my-1 border-t" />
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Total</span>
                <span className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(totals.total)}</span>
              </div>
              <Button
                className="mt-2 h-12 w-full gap-2 text-base"
                disabled={!canSubmit}
                onClick={() => createPurchase.mutate()}
              >
                {createPurchase.isPending
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving…</>
                  : <><Truck className="h-5 w-5" /> Receive Stock · {formatCurrency(totals.total)}</>}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent purchases */}
      <Card className="p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-primary" /> Recent Purchases
          </h3>
          <span className="text-[11px] text-muted-foreground">Last 5</span>
        </div>
        {recentPurchasesQuery.isLoading ? (
          <LoadingState className="py-8" />
        ) : (recentPurchasesQuery.data?.data ?? []).length === 0 ? (
          <EmptyState icon={Truck} title="No purchases yet" description="Your received stock will appear here." className="py-8" />
        ) : (
          <div className="divide-y">
            {(recentPurchasesQuery.data?.data ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => openDetail(p.id)}
                className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-accent/40 rounded-md px-2 -mx-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.supplier?.name ?? "—"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{p.poNo}</span> · {timeAgo(p.createdAt)}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1">
                  {p.status === "CANCELLED" ? (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400">Cancelled</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Received</Badge>
                  )}
                  <PaymentStatusBadge status={p.paymentStatus} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(p.total)}</p>
                  <p className="text-[11px] text-muted-foreground">{p.items?.length ?? 0} items</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <PurchaseDetailSheet purchase={detailPurchase} onOpenChange={(o) => !o && setDetailPurchase(null)} />
    </div>
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
