"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentStatusBadge, PaymentMethodBadge } from "@/components/shared/badges";
import { QrDisplay } from "@/components/shared/qr-barcode";
import { ScannerButton } from "@/components/shared/scanner-button";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart, Plus, Search, Trash2, Printer, Receipt,
  Wallet, TrendingUp, AlertCircle, Package, Minus, Loader2, User2,
  Banknote, CreditCard, Landmark, Smartphone, X, Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface Customer {
  id: string; name: string; phone?: string | null;
  company?: string | null; address?: string | null;
}
interface Product {
  id: string; sku: string; name: string;
  sellingPrice: number; purchasePrice: number; stock: number;
  brand?: { name: string } | null; model?: { name: string } | null;
}
interface SaleItem {
  id: string; productId: string; name: string; qty: number; price: number;
  cost: number; discount: number; total: number;
  product?: { sku?: string; brand?: { name: string } | null; model?: { name: string } | null };
}
interface Sale {
  id: string; invoiceNo: string; customerId?: string | null;
  customer?: Customer | null; user?: { name: string } | null;
  subtotal: number; discount: number; tax: number; total: number; profit: number;
  paid: number; paymentMethod: string; paymentStatus: string; status: string;
  notes?: string | null; createdAt: string; items: SaleItem[];
  business?: { name: string; phone: string; address: string; email: string; currencySymbol: string; taxName: string };
}
interface CartLine {
  key: string; productId: string; name: string; sku: string;
  qty: number; price: number; cost: number; discount: number; stock: number;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "BANK", label: "Bank", icon: Landmark },
  { value: "MOBILE", label: "Mobile", icon: Smartphone },
] as const;

const PAYMENT_STATUS_OPTIONS = ["PAID", "PARTIAL", "UNPAID"] as const;

// ────────────────────────────────────────────────────────────────────────────
// Main view — single-screen POS
// ────────────────────────────────────────────────────────────────────────────
export function SalesView() {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentStatus, setPaymentStatus] = useState<string>("PAID");
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const customers = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers"),
    staleTime: 60_000,
  });

  const productSearch = useQuery<{ data: Product[] }>({
    queryKey: ["products-pos", search],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(search)}&pageSize=10`),
    enabled: search.length > 0,
    staleTime: 10_000,
  });

  // Recent sales — top 5 for the compact list
  const recentSalesQuery = useQuery<{ data: Sale[] }>({
    queryKey: ["sales-recent"],
    queryFn: () => api.get(`/sales?pageSize=5`),
    staleTime: 15_000,
  });

  // Stats — fetch first 100 sales for aggregation
  const statsQuery = useQuery<{ data: Sale[] }>({
    queryKey: ["sales-stats"],
    queryFn: () => api.get(`/sales?pageSize=100`),
    staleTime: 30_000,
  });
  const stats = useMemo(() => {
    const all = statsQuery.data?.data ?? [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let todayTotal = 0, todayCount = 0, monthTotal = 0, outstanding = 0;
    for (const s of all) {
      const t = new Date(s.createdAt).getTime();
      if (s.status !== "RETURNED") {
        if (t >= todayStart) { todayTotal += s.total; todayCount++; }
        if (t >= monthStart) monthTotal += s.total;
      }
      if (s.paymentStatus !== "PAID") outstanding += Math.max(0, s.total - s.paid);
    }
    return { todayTotal, todayCount, monthTotal, outstanding };
  }, [statsQuery.data]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
    const lineDiscounts = cart.reduce((s, l) => s + l.discount, 0);
    const cost = cart.reduce((s, l) => s + l.qty * l.cost, 0);
    const net = subtotal - lineDiscounts - overallDiscount;
    const total = Math.max(0, net + tax);
    const profit = net - cost;
    const paid = paymentStatus === "PAID" ? total
      : paymentStatus === "PARTIAL" ? Math.min(total, amountPaid)
      : 0;
    return { subtotal, lineDiscounts, cost, net, total, profit, paid };
  }, [cart, overallDiscount, tax, paymentStatus, amountPaid]);

  // When payment status flips to PAID, sync amountPaid to total — done during render (no useEffect+setState).
  if (paymentStatus === "PAID" && amountPaid !== totals.total && totals.total > 0) {
    setAmountPaid(totals.total);
  }

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => l.productId === p.id ? { ...l, qty: Math.min(l.stock, l.qty + 1) } : l);
      }
      return [...prev, {
        key: p.id, productId: p.id, name: p.name, sku: p.sku,
        qty: 1, price: p.sellingPrice, cost: p.purchasePrice, discount: 0, stock: p.stock,
      }];
    });
    setSearch("");
  };

  const handleScanDetected = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const res = await api.get<{ data: Product[] }>(
        `/products?q=${encodeURIComponent(trimmed)}&pageSize=10`,
      );
      const matches = res?.data ?? [];
      if (matches.length === 1) {
        addToCart(matches[0]);
        toast.success(`Added "${matches[0].name}" to cart`);
      } else if (matches.length > 1) {
        setSearch(trimmed);
        toast.info(`${matches.length} products match — pick one below.`);
      } else {
        toast.error(`No product found for code "${trimmed}"`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const updateLine = (key: string, patch: Partial<CartLine>) => {
    setCart((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
  };
  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));
  const clearCart = () => {
    setCart([]);
    setOverallDiscount(0);
    setTax(0);
    setPaymentMethod("CASH");
    setPaymentStatus("PAID");
    setAmountPaid(0);
    setNotes("");
    setCustomerId("");
  };

  const createSale = useMutation({
    mutationFn: () => api.post<Sale>("/sales", {
      customerId: customerId || undefined,
      items: cart.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price, discount: l.discount })),
      discount: overallDiscount,
      tax,
      paymentMethod,
      paymentStatus,
      paid: paymentStatus === "PARTIAL" ? amountPaid : undefined,
      notes,
    }),
    onSuccess: (sale) => {
      toast.success(`Sale ${sale.invoiceNo} completed · ${formatCurrency(sale.total)}`);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      clearCart();
      setShowCheckout(false);
      setInvoiceSale(sale);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = cart.length > 0 && !createSale.isPending &&
    cart.every((l) => l.qty > 0 && l.qty <= l.stock);

  const openInvoice = async (id: string) => {
    try {
      const sale = await api.get<Sale>(`/sales/${id}`);
      setInvoiceSale(sale);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales & Checkout"
        description="Search · add to cart · take payment — all on one screen"
        icon={ShoppingCart}
      />

      {/* Compact KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={formatCurrency(stats.todayTotal)} icon={Wallet} accent="emerald" subtitle={`${stats.todayCount} sales`} />
        <StatCard label="This Month" value={formatCurrency(stats.monthTotal)} icon={TrendingUp} accent="teal" subtitle="Revenue" />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} icon={AlertCircle} accent="amber" subtitle="Unpaid invoices" />
        <StatCard label="Cart Items" value={cart.length} icon={ShoppingCart} accent="purple" subtitle={`${cart.reduce((s, l) => s + l.qty, 0)} units`} />
      </div>

      {/* POS — single screen */}
      <Card className="overflow-hidden p-0 shadow-soft">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
          {/* LEFT: search + cart */}
          <div className="flex flex-col border-b lg:border-b-0 lg:border-r">
            {/* Search bar */}
            <div className="border-b p-4 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                <ScannerButton
                  label="Scan"
                  onDetected={handleScanDetected}
                  className="h-11 shrink-0"
                  size="default"
                />
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
                    {(productSearch.data?.data ?? []).map((p) => {
                      const out = p.stock <= 0;
                      return (
                        <motion.button
                          key={p.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onClick={() => out ? toast.error("Out of stock") : addToCart(p)}
                          disabled={out}
                          className={cn(
                            "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 transition",
                            out ? "cursor-not-allowed opacity-50" : "hover:bg-accent",
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Package className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.sku} · {p.brand?.name ?? ""} {p.model?.name ?? ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-600">{formatCurrency(p.sellingPrice)}</p>
                            <p className={cn("text-[11px]", out ? "text-rose-600" : "text-muted-foreground")}>
                              {out ? "Out of stock" : `${p.stock} in stock`}
                            </p>
                          </div>
                          {!out && <Plus className="h-4 w-4 text-primary" />}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Cart header */}
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Cart
                {cart.length > 0 && (
                  <Badge variant="secondary" className="font-semibold">{cart.length}</Badge>
                )}
              </h3>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={clearCart}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>

            {/* Cart body */}
            <div className="flex-1 overflow-hidden">
              {cart.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Cart is empty"
                  description="Search products above and click to add them to the cart."
                  className="py-10"
                />
              ) : (
                <ScrollArea className="max-h-[460px]">
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
                                {l.sku} · cost {formatCurrency(l.cost)} · {l.stock} in stock
                              </p>
                            </div>
                            <button
                              onClick={() => removeLine(l.key)}
                              className="rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove from cart"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
                            {/* Qty stepper */}
                            <div className="col-span-2 sm:col-span-1">
                              <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                              <div className="mt-0.5 flex items-center gap-1">
                                <Button size="icon" variant="outline" className="h-8 w-8" type="button"
                                  onClick={() => updateLine(l.key, { qty: Math.max(1, l.qty - 1) })}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number" min={1} max={l.stock}
                                  value={l.qty}
                                  onChange={(e) => {
                                    const v = Math.max(1, Math.min(l.stock, Number(e.target.value) || 1));
                                    updateLine(l.key, { qty: v });
                                  }}
                                  className="h-8 w-14 px-2 text-center"
                                />
                                <Button size="icon" variant="outline" className="h-8 w-8" type="button"
                                  onClick={() => updateLine(l.key, { qty: Math.min(l.stock, l.qty + 1) })}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {/* Price */}
                            <div>
                              <Label className="text-[10px] uppercase text-muted-foreground">Price</Label>
                              <Input
                                type="number" min={0} step="any"
                                value={l.price}
                                onChange={(e) => updateLine(l.key, { price: Math.max(0, Number(e.target.value) || 0) })}
                                className="mt-0.5 h-8 px-2"
                              />
                            </div>
                            {/* Discount */}
                            <div>
                              <Label className="text-[10px] uppercase text-muted-foreground">Disc</Label>
                              <Input
                                type="number" min={0} step="any"
                                value={l.discount}
                                onChange={(e) => updateLine(l.key, { discount: Math.max(0, Number(e.target.value) || 0) })}
                                className="mt-0.5 h-8 px-2"
                              />
                            </div>
                            {/* Line total */}
                            <div className="text-right">
                              <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                              <p className="mt-0.5 flex h-8 items-center justify-end text-sm font-bold text-foreground">
                                {formatCurrency(Math.max(0, l.qty * l.price - l.discount))}
                              </p>
                            </div>
                          </div>
                          {l.qty > l.stock && (
                            <p className="mt-1 text-[11px] font-medium text-rose-600">⚠ Exceeds available stock ({l.stock})</p>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Mobile checkout trigger */}
            {cart.length > 0 && (
              <div className="border-t p-3 lg:hidden">
                <Button
                  className="h-12 w-full gap-2 text-base"
                  onClick={() => setShowCheckout(true)}
                >
                  <Receipt className="h-5 w-5" />
                  Checkout · {formatCurrency(totals.total)}
                </Button>
              </div>
            )}
          </div>

          {/* RIGHT: checkout panel — always visible on lg, slide-over on mobile */}
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
                <Receipt className="h-4 w-4 text-primary" /> Checkout
              </h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCheckout(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 lg:max-h-[520px]">
              <div className="space-y-4 p-4">
                {/* Customer */}
                <div>
                  <Label className="text-xs font-medium">Customer <span className="text-muted-foreground">(optional)</span></Label>
                  <Select value={customerId || "walkin"} onValueChange={(v) => setCustomerId(v === "walkin" ? "" : v)}>
                    <SelectTrigger className="mt-1 h-10 w-full"><SelectValue placeholder="Walk-in Customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walkin">Walk-in Customer</SelectItem>
                      {(customers.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment method — big button group */}
                <div>
                  <Label className="text-xs font-medium">Payment Method</Label>
                  <div className="mt-1 grid grid-cols-4 gap-2">
                    {PAYMENT_METHOD_OPTIONS.map((m) => {
                      const active = paymentMethod === m.value;
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setPaymentMethod(m.value)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition",
                            active
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[11px] font-medium">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Payment status */}
                <div>
                  <Label className="text-xs font-medium">Payment Status</Label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {PAYMENT_STATUS_OPTIONS.map((s) => {
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

                {/* Amount paid — only for PARTIAL */}
                {paymentStatus === "PARTIAL" && (
                  <div>
                    <Label className="text-xs font-medium">Amount Paid</Label>
                    <Input
                      type="number" min={0} step="any" max={totals.total}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 h-10"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Balance due: {formatCurrency(Math.max(0, totals.total - amountPaid))}
                    </p>
                  </div>
                )}

                {/* Discount + Tax */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium">Discount</Label>
                    <Input type="number" min={0} step="any" value={overallDiscount || ""}
                      onChange={(e) => setOverallDiscount(Math.max(0, Number(e.target.value) || 0))}
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
                    rows={2} placeholder="Invoice notes…" className="mt-1 resize-none" />
                </div>
              </div>
            </ScrollArea>

            {/* Totals + submit */}
            <div className="border-t bg-background p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.lineDiscounts > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Item discounts</span>
                  <span className="tabular-nums">− {formatCurrency(totals.lineDiscounts)}</span>
                </div>
              )}
              {overallDiscount > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Discount</span>
                  <span className="tabular-nums">− {formatCurrency(overallDiscount)}</span>
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
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Est. profit</span>
                <span className={cn("font-semibold tabular-nums", totals.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                  {formatCurrency(totals.profit)}
                </span>
              </div>
              <Button
                className="mt-2 h-12 w-full gap-2 text-base"
                disabled={!canSubmit}
                onClick={() => createSale.mutate()}
              >
                {createSale.isPending
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Completing…</>
                  : <><Receipt className="h-5 w-5" /> Complete Sale · {formatCurrency(totals.total)}</>}
              </Button>
              {cart.some((l) => l.qty > l.stock) && (
                <p className="text-center text-[11px] text-rose-600">Fix stock issues before completing</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Recent sales */}
      <Card className="p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="h-4 w-4 text-primary" /> Recent Sales
          </h3>
          <span className="text-[11px] text-muted-foreground">Last 5</span>
        </div>
        {recentSalesQuery.isLoading ? (
          <LoadingState className="py-8" />
        ) : (recentSalesQuery.data?.data ?? []).length === 0 ? (
          <EmptyState icon={Receipt} title="No sales yet" description="Your completed sales will appear here." className="py-8" />
        ) : (
          <div className="divide-y">
            {(recentSalesQuery.data?.data ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => openInvoice(s.id)}
                className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-accent/40 rounded-md px-2 -mx-2"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.customer?.name ?? "Walk-in Customer"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <span className="font-mono">{s.invoiceNo}</span> · {timeAgo(s.createdAt)}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1">
                  <PaymentMethodBadge method={s.paymentMethod} />
                  <PaymentStatusBadge status={s.paymentStatus} />
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(s.total)}</p>
                  <p className="text-[11px] text-muted-foreground">{s.items?.length ?? 0} items</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <InvoiceDialog sale={invoiceSale} onOpenChange={(o) => !o && setInvoiceSale(null)} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Invoice Dialog (view + print) — unchanged from prior version
// ────────────────────────────────────────────────────────────────────────────
function InvoiceDialog({
  sale, onOpenChange,
}: {
  sale: Sale | null;
  onOpenChange: (o: boolean) => void;
}) {
  const open = !!sale;
  const qc = useQueryClient();

  const handlePrint = () => {
    if (!sale) return;
    const rows = sale.items.map((it) => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12px">${escapeHtml(it.name)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12px;text-align:center">${it.qty}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${formatCurrency(it.price, sale.business?.currencySymbol ?? "Rs")}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${it.discount ? "− " + formatCurrency(it.discount, sale.business?.currencySymbol ?? "Rs") : "—"}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-weight:600">${formatCurrency(it.total, sale.business?.currencySymbol ?? "Rs")}</td>
      </tr>
    `).join("");

    const biz = sale.business;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${sale.invoiceNo}</title>
      <style>
        * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
        body { padding: 32px; max-width: 720px; margin: 0 auto; }
        h1 { font-size: 22px; margin: 0; color: #059669; }
        .muted { color: #64748b; font-size: 12px; }
        .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 16px; }
        .meta { text-align: right; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; padding: 8px 6px; border-bottom: 2px solid #e2e8f0; }
        .totals { margin-left: auto; width: 280px; font-size: 13px; }
        .totals div { display:flex; justify-content:space-between; padding: 4px 0; }
        .totals .grand { font-size: 16px; font-weight: 700; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 8px; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 11px; color: #64748b; }
      </style></head><body>
      <div class="head">
        <div>
          <h1>${escapeHtml(biz?.name ?? "PartsHub")}</h1>
          <p class="muted">${escapeHtml(biz?.address ?? "")}</p>
          <p class="muted">${biz?.phone ? "Tel: " + escapeHtml(biz.phone) : ""} ${biz?.email ? " · " + escapeHtml(biz.email) : ""}</p>
        </div>
        <div class="meta">
          <h2 style="margin:0;font-size:18px">INVOICE</h2>
          <p class="muted"><strong>${escapeHtml(sale.invoiceNo)}</strong></p>
          <p class="muted">${formatDateTime(sale.createdAt)}</p>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div>
          <p style="margin:0;font-size:11px;text-transform:uppercase;color:#64748b">Bill To</p>
          <p style="margin:2px 0 0;font-weight:600">${escapeHtml(sale.customer?.name ?? "Walk-in Customer")}</p>
          ${sale.customer?.phone ? `<p class="muted">${escapeHtml(sale.customer.phone)}</p>` : ""}
          ${sale.customer?.address ? `<p class="muted">${escapeHtml(sale.customer.address)}</p>` : ""}
        </div>
        <div style="text-align:right">
          <p style="margin:0;font-size:11px;text-transform:uppercase;color:#64748b">Payment</p>
          <p style="margin:2px 0 0;font-weight:600">${sale.paymentMethod}</p>
          <p class="muted">${sale.paymentStatus}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Item</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Price</th>
            <th style="text-align:right">Disc</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>${formatCurrency(sale.subtotal, sale.business?.currencySymbol ?? "Rs")}</span></div>
        ${sale.discount ? `<div><span>Discount</span><span>− ${formatCurrency(sale.discount, sale.business?.currencySymbol ?? "Rs")}</span></div>` : ""}
        ${sale.tax ? `<div><span>Tax</span><span>+ ${formatCurrency(sale.tax, sale.business?.currencySymbol ?? "Rs")}</span></div>` : ""}
        <div class="grand"><span>Total</span><span>${formatCurrency(sale.total, sale.business?.currencySymbol ?? "Rs")}</span></div>
        ${sale.paid > 0 ? `<div><span>Paid</span><span>${formatCurrency(sale.paid, sale.business?.currencySymbol ?? "Rs")}</span></div>` : ""}
        ${sale.total - sale.paid > 0 ? `<div><span>Balance Due</span><span>${formatCurrency(sale.total - sale.paid, sale.business?.currencySymbol ?? "Rs")}</span></div>` : ""}
      </div>
      ${sale.notes ? `<div style="margin-top:16px;padding:12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc"><p style="margin:0;font-size:11px;text-transform:uppercase;color:#64748b">Notes</p><p style="margin:4px 0 0;font-size:12px">${escapeHtml(sale.notes)}</p></div>` : ""}
      <div class="footer">
        <p>Thank you for your business!</p>
        <p style="margin-top:4px">This is a computer-generated invoice and is valid without signature.</p>
      </div>
      </body></html>`;
    const w = window.open("", "_blank", "width=820,height=720");
    if (!w) { toast.error("Please allow pop-ups to print invoices"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const handleReturn = async () => {
    if (!sale) return;
    if (!confirm(`Mark invoice ${sale.invoiceNo} as RETURNED? Items will be restocked.`)) return;
    try {
      await api.put(`/sales/${sale.id}`, { status: "RETURNED" });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Invoice ${sale.invoiceNo} marked as returned.`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> Invoice {sale?.invoiceNo}
              </DialogTitle>
              <DialogDescription>{sale ? formatDateTime(sale.createdAt) : ""}</DialogDescription>
            </div>
            <div className="flex gap-2">
              {sale && sale.status !== "RETURNED" && (
                <Button variant="outline" size="sm" className="gap-1.5 text-amber-600" onClick={handleReturn}>
                  <Sparkles className="h-4 w-4" /> Return
                </Button>
              )}
              <Button size="sm" className="gap-1.5" onClick={handlePrint}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </div>
        </DialogHeader>

        {sale && (
          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary">{sale.business?.name ?? "PartsHub"}</h3>
                  <p className="text-xs text-muted-foreground">{sale.business?.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.business?.phone ? `Tel: ${sale.business.phone}` : ""}
                    {sale.business?.email ? ` · ${sale.business.email}` : ""}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bill To</p>
                  <p className="text-sm font-semibold">{sale.customer?.name ?? "Walk-in Customer"}</p>
                  {sale.customer?.phone && <p className="text-xs text-muted-foreground">{sale.customer.phone}</p>}
                  {sale.customer?.address && <p className="text-xs text-muted-foreground">{sale.customer.address}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Badge variant="outline" className="font-mono">{sale.invoiceNo}</Badge>
                <PaymentMethodBadge method={sale.paymentMethod} />
                <PaymentStatusBadge status={sale.paymentStatus} />
                {sale.status === "RETURNED" ? (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400">Returned</Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Completed</Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <QrDisplay value={sale.invoiceNo} size={64} />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Item</th>
                      <th className="px-3 py-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">Qty</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Price</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Disc</th>
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">
                          <p className="font-medium">{it.name}</p>
                          <p className="text-[11px] text-muted-foreground">{it.product?.sku ?? ""}</p>
                        </td>
                        <td className="px-3 py-2 text-center">{it.qty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(it.price, sale.business?.currencySymbol ?? "Rs")}</td>
                        <td className="px-3 py-2 text-right">{it.discount ? "− " + formatCurrency(it.discount, sale.business?.currencySymbol ?? "Rs") : "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(it.total, sale.business?.currencySymbol ?? "Rs")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                <Row label="Subtotal" value={formatCurrency(sale.subtotal, sale.business?.currencySymbol ?? "Rs")} />
                {sale.discount > 0 && <Row label="Discount" value={`− ${formatCurrency(sale.discount, sale.business?.currencySymbol ?? "Rs")}`} muted />}
                {sale.tax > 0 && <Row label="Tax" value={`+ ${formatCurrency(sale.tax, sale.business?.currencySymbol ?? "Rs")}`} />}
                <div className="my-1 border-t" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(sale.total, sale.business?.currencySymbol ?? "Rs")}</span>
                </div>
                {sale.paid > 0 && <Row label="Paid" value={formatCurrency(sale.paid, sale.business?.currencySymbol ?? "Rs")} />}
                {sale.total - sale.paid > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-400">
                    <span className="text-xs font-medium">Balance Due</span>
                    <span className="font-semibold">{formatCurrency(sale.total - sale.paid, sale.business?.currencySymbol ?? "Rs")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">Est. profit</span>
                  <span className={`font-semibold ${sale.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(sale.profit, sale.business?.currencySymbol ?? "Rs")}
                  </span>
                </div>
              </div>

              {sale.notes && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase text-amber-600">Notes</p>
                  <p className="text-sm">{sale.notes}</p>
                </div>
              )}

              {sale.user && (
                <p className="text-center text-[11px] text-muted-foreground">Served by {sale.user.name}</p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-amber-600" : "text-muted-foreground"}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
