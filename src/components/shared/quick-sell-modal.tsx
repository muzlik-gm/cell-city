"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Minus,
  Plus,
  ShoppingCart,
  Loader2,
  CheckCircle2,
  Package,
  MapPin,
  Banknote,
  CreditCard,
  Building2,
  Smartphone,
  Users,
} from "lucide-react";

const PAYMENT_METHODS: {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "BANK", label: "Bank", icon: Building2 },
  { value: "MOBILE", label: "Mobile", icon: Smartphone },
];

interface QuickSellModalProps {
  /** The product to sell. Pass null/undefined when closed. */
  product: any | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Quick Sell — a fast, single-screen sale dialog.
 *
 * Lets the operator sell a product without navigating to the Sales view.
 * Everything is visible on one screen: qty stepper, editable price, customer
 * (optional, walk-in default), payment method, and a live total. A sale can be
 * completed in under 10 seconds.
 *
 * Uses the keyed-remount pattern (outer wrapper + keyed inner) so internal
 * form state resets cleanly whenever the target product changes — avoiding
 * setState-in-effect lint errors.
 */
export function QuickSellModal({ product, open, onOpenChange }: QuickSellModalProps) {
  if (!product) return null;
  return (
    <QuickSellInner
      key={product.id ?? "new"}
      product={product}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

function QuickSellInner({
  product,
  open,
  onOpenChange,
}: {
  product: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();

  // ── Pull the customer list (cached) ───────────────────────────────────
  const customersQ = useQuery({
    queryKey: ["customers", "quick-sell"],
    queryFn: () => api.get<any[]>("/customers"),
    staleTime: 60_000,
  });

  // ── Form state (initialized from product prop — safe because this is a
  //    keyed remount, so the inner component is fresh per product). ───────
  const stock = Math.max(0, Math.floor(Number(product.stock ?? 0)));
  const sellingPrice = Number(product.sellingPrice ?? 0);

  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<string>(String(sellingPrice || 0));
  const [discount, setDiscount] = useState<string>("0");
  const [customerId, setCustomerId] = useState<string>("walk-in");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");

  // Clamp qty to [1, stock]. Implemented with the "adjust state during
  // render" pattern (no useEffect + setState) to satisfy strict lint rules.
  let safeQty = qty;
  if (stock <= 0) safeQty = 0;
  else if (safeQty < 1) safeQty = 1;
  else if (safeQty > stock) safeQty = stock;
  if (safeQty !== qty) setQty(safeQty);

  const priceN = Number(price) || 0;
  const discountN = Math.max(0, Number(discount) || 0);
  const subtotal = safeQty * priceN;
  const total = Math.max(0, subtotal - discountN);
  const outOfStock = stock <= 0;
  const canSubmit =
    !outOfStock && safeQty >= 1 && safeQty <= stock && priceN > 0;

  // ── Submit (POST /api/sales) ──────────────────────────────────────────
  const submit = useMutation({
    mutationFn: async () => {
      const body = {
        customerId: customerId === "walk-in" ? null : customerId,
        items: [
          {
            productId: product.id,
            qty: safeQty,
            price: priceN,
            discount: discountN,
          },
        ],
        discount: discountN,
        paymentMethod,
        paymentStatus: "PAID" as const,
      };
      return api.post<{ invoiceNo: string; id: string }>("/sales", body);
    },
    onSuccess: (sale) => {
      // Invalidate everything that depends on stock / sales / dashboard.
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["universal-search"] });
      qc.invalidateQueries({ queryKey: ["dash-summary"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications-lowstock"] });
      qc.invalidateQueries({ queryKey: ["lowstock-count"] });
      qc.invalidateQueries({ queryKey: ["home-lowstock"] });
      qc.invalidateQueries({ queryKey: ["home-lowstock-summary"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success(`Sold! ${sale.invoiceNo}`, {
        description: `${safeQty} × ${product.name} · ${formatCurrency(total)}`,
      });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stepQty = (delta: number) => {
    setQty((q) => {
      const next = q + delta;
      if (stock <= 0) return 0;
      return Math.min(stock, Math.max(1, next));
    });
  };

  const shelfCode = product.shelf?.code ?? null;
  const warehouseName = product.warehouse?.name ?? null;

  // Memo a friendly description for the dialog header
  const headerSub = useMemo(() => {
    const bits: string[] = [];
    bits.push(`SKU ${product.sku ?? "—"}`);
    if (shelfCode) bits.push(shelfCode);
    if (warehouseName) bits.push(warehouseName);
    return bits.join(" · ");
  }, [product.sku, shelfCode, warehouseName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Quick Sell
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            {product.name} · <span className="font-mono">{headerSub}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[72vh]">
          <div className="space-y-5 px-5 py-4">
            {/* ── Product headline: name + stock + price prominently ──── */}
            <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-4">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                {product.name}
              </h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <HeadlineStat
                  label="In Stock"
                  value={String(stock)}
                  tone={outOfStock ? "rose" : stock <= (product.minStock ?? 0) ? "amber" : "emerald"}
                  icon={<Package className="h-3.5 w-3.5" />}
                />
                <HeadlineStat
                  label="Sell Price"
                  value={formatCurrency(sellingPrice)}
                  tone="emerald"
                />
                <HeadlineStat
                  label="Location"
                  value={shelfCode ?? "—"}
                  icon={<MapPin className="h-3.5 w-3.5" />}
                />
              </div>
              {outOfStock && (
                <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  Out of stock — restock before selling.
                </p>
              )}
            </div>

            {/* ── Quantity stepper (big buttons) ──────────────────────── */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Quantity
                </label>
                <span className="text-[11px] text-muted-foreground">
                  max {stock}
                </span>
              </div>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => stepQty(-1)}
                  disabled={outOfStock || safeQty <= 1}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-xl border bg-card text-foreground transition",
                    "hover:bg-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-5 w-5" />
                </button>
                <Input
                  type="number"
                  min={1}
                  max={stock}
                  inputMode="numeric"
                  value={safeQty}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setQty(Math.floor(v));
                    else setQty(1);
                  }}
                  className="h-14 flex-1 rounded-xl border-2 text-center text-2xl font-bold focus-visible:border-primary"
                />
                <button
                  type="button"
                  onClick={() => stepQty(1)}
                  disabled={outOfStock || safeQty >= stock}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-xl border bg-card text-foreground transition",
                    "hover:bg-accent active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* ── Price (editable) ────────────────────────────────────── */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Unit Price
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  Rs
                </span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-12 rounded-xl pl-10 text-base font-semibold"
                />
              </div>
            </div>

            {/* ── Discount (optional) ────────────────────────────────── */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Discount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  Rs
                </span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-12 rounded-xl pl-10 text-base font-semibold"
                />
              </div>
            </div>

            {/* ── Customer (optional, walk-in default) ────────────────── */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Customer
                <span className="font-normal normal-case text-muted-foreground/70">· optional</span>
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">
                    <span className="flex items-center gap-2 text-muted-foreground italic">
                      Walk-in customer
                    </span>
                  </SelectItem>
                  <Separator className="my-1" />
                  {customersQ.isLoading ? (
                    <SelectItem value="__loading" disabled>
                      Loading…
                    </SelectItem>
                  ) : customersQ.data && customersQ.data.length > 0 ? (
                    customersQ.data.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.company ? ` · ${c.company}` : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty" disabled>
                      No customers found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ── Payment method (big button group) ───────────────────── */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payment Method
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.value;
                  return (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border bg-card py-3 text-[11px] font-semibold transition-all active:scale-95",
                        active
                          ? "border-primary/60 bg-primary/5 text-primary ring-2 ring-primary/30"
                          : "border-border text-muted-foreground hover:bg-accent/40",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* ── Sticky footer: live total + complete sale ──────────────── */}
        <Separator />
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            {discountN > 0 && (
              <p className="text-[10px] text-muted-foreground">
                <span>{formatCurrency(subtotal)}</span>
                <span className="mx-1 text-rose-500">− {formatCurrency(discountN)}</span>
              </p>
            )}
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total {safeQty > 1 ? `· ${safeQty} × ${formatCurrency(priceN)}` : ""}
            </p>
            <p className="text-2xl font-bold leading-tight text-emerald-600 dark:text-emerald-400">
              {formatCurrency(total)}
            </p>
          </div>
          <Button
            size="lg"
            className="h-12 gap-2 px-6 text-sm font-semibold shadow-soft"
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Complete Sale
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeadlineStat({
  label,
  value,
  tone = "muted",
  icon,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "rose" | "muted";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "rose"
          ? "text-rose-600 dark:text-rose-400"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-card px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn("mt-0.5 truncate text-sm font-bold", toneClass)} title={value}>
        {value}
      </p>
    </div>
  );
}
