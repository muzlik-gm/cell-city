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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StockBadge } from "@/components/shared/badges";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Scale,
  Loader2,
  Save,
  Package,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from "lucide-react";

type AdjustType = "IN" | "OUT" | "ADJUST";

const REASONS_BY_TYPE: Record<AdjustType, { value: string; label: string }[]> = {
  IN: [
    { value: "RESTOCK", label: "Restock from supplier" },
    { value: "FOUND", label: "Found misplaced stock" },
    { value: "RETURNED", label: "Customer return" },
    { value: "SAMPLE", label: "Sample / demo unit" },
    { value: "OTHER", label: "Other reason" },
  ],
  OUT: [
    { value: "LOST", label: "Lost / missing" },
    { value: "DAMAGED", label: "Damaged in storage" },
    { value: "RETURNED", label: "Returned to supplier" },
    { value: "OTHER", label: "Other reason" },
  ],
  ADJUST: [
    { value: "COUNT_CORRECTION", label: "Physical count correction" },
    { value: "OTHER", label: "Other reason" },
  ],
};

interface StockAdjustDialogProps {
  /** The product to adjust. Pass null/undefined when closed. */
  product: any | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Optionally force the dialog to open in a specific mode (e.g. "IN" for restock). */
  initialMode?: AdjustType;
}

/**
 * Reusable Stock Adjustment dialog. Supports 3 modes — Add Stock (IN),
 * Remove Stock (OUT), Set Quantity (ADJUST) — with contextual reasons,
 * optional price updates (IN only) and a live before→after preview.
 */
export function StockAdjustDialog({
  product,
  open,
  onOpenChange,
  initialMode = "IN",
}: StockAdjustDialogProps) {
  // Keyed remount so internal state resets cleanly whenever the target product
  // changes (mirrors the ProductFormDialog pattern). Avoids setState-in-effect.
  if (!product) {
    // Don't render the dialog content when there's no product (closed state).
    // Returning null keeps the dialog closed without an empty DialogContent.
    return null;
  }

  return (
    <StockAdjustInner
      key={product.id ?? "new"}
      product={product}
      open={open}
      onOpenChange={onOpenChange}
      initialMode={initialMode}
    />
  );
}

function StockAdjustInner({
  product,
  open,
  onOpenChange,
  initialMode,
}: {
  product: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialMode: AdjustType;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<AdjustType>(initialMode);
  const [reason, setReason] = useState<string>(
    REASONS_BY_TYPE[initialMode][0].value,
  );
  const [qty, setQty] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [priceUpdateEnabled, setPriceUpdateEnabled] = useState(false);
  const [newPurchasePrice, setNewPurchasePrice] = useState<string>("");
  const [newSellingPrice, setNewSellingPrice] = useState<string>("");

  // When the user switches adjustment type, ensure the selected reason is valid
  // for that type. Implemented with the "adjust state during render" pattern
  // (no useEffect + setState) to satisfy the strict lint rule.
  let activeReason = reason;
  if (!REASONS_BY_TYPE[type].some((r) => r.value === reason)) {
    activeReason = REASONS_BY_TYPE[type][0].value;
  }
  if (activeReason !== reason) {
    setReason(activeReason);
  }

  const stock = Number(product.stock ?? 0);
  const minStock = Number(product.minStock ?? 0);
  const purchasePrice = Number(product.purchasePrice ?? 0);
  const sellingPrice = Number(product.sellingPrice ?? 0);

  const qtyN = Number(qty);
  const qtyValid = Number.isFinite(qtyN) && qtyN >= 0 && qty !== "";

  // ── Live preview calculation ───────────────────────────────────────────
  const { newStock, stockDelta, oldValue, newValue, valueDelta } =
    useMemo(() => {
      let nextStock = stock;
      if (type === "IN") nextStock = stock + (qtyValid ? Math.floor(qtyN) : 0);
      else if (type === "OUT")
        nextStock = stock - (qtyValid ? Math.floor(qtyN) : 0);
      else nextStock = qtyValid ? Math.floor(qtyN) : stock;

      // For value preview use the *new* prices if a price update is enabled.
      const pp = priceUpdateEnabled && newPurchasePrice !== ""
        ? Number(newPurchasePrice) || purchasePrice
        : purchasePrice;
      const sp = priceUpdateEnabled && newSellingPrice !== ""
        ? Number(newSellingPrice) || sellingPrice
        : sellingPrice;

      const oldVal = stock * purchasePrice;
      const newVal = nextStock * sp;
      return {
        newStock: nextStock,
        stockDelta: nextStock - stock,
        oldValue: oldVal,
        newValue: newVal,
        valueDelta: newVal - oldVal,
      };
    }, [
      type,
      qtyN,
      qtyValid,
      stock,
      purchasePrice,
      sellingPrice,
      priceUpdateEnabled,
      newPurchasePrice,
      newSellingPrice,
    ]);

  // ── Validation ─────────────────────────────────────────────────────────
  const qtyRequired = type === "ADJUST" ? qtyValid : qtyValid && qtyN > 0;
  const stockWillGoNegative = type === "OUT" && qtyValid && newStock < 0;
  const previewPurchase =
    priceUpdateEnabled && newPurchasePrice !== ""
      ? Number(newPurchasePrice)
      : purchasePrice;
  const previewSelling =
    priceUpdateEnabled && newSellingPrice !== ""
      ? Number(newSellingPrice)
      : sellingPrice;
  const margin = previewSelling - previewPurchase;
  const marginPct =
    previewSelling > 0 ? Math.round((margin / previewSelling) * 100) : 0;

  const priceInputsValid =
    !priceUpdateEnabled ||
    ((!newPurchasePrice || (Number(newPurchasePrice) >= 0)) &&
      (!newSellingPrice || Number(newSellingPrice) >= 0));

  const canSubmit =
    qtyRequired &&
    !stockWillGoNegative &&
    priceInputsValid &&
    (type !== "ADJUST" || newStock !== stock || note.trim() !== "");

  // ── Submit ─────────────────────────────────────────────────────────────
  const submit = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        type,
        qty: type === "ADJUST" ? Math.floor(qtyN) : Math.floor(qtyN),
        reason,
        note: note.trim() || undefined,
      };
      if (
        type === "IN" &&
        priceUpdateEnabled &&
        (newPurchasePrice !== "" || newSellingPrice !== "")
      ) {
        if (newPurchasePrice !== "")
          body.newPurchasePrice = Number(newPurchasePrice);
        if (newSellingPrice !== "")
          body.newSellingPrice = Number(newSellingPrice);
      }
      return api.post(`/products/${product.id}/adjust`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["dash-summary"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["notifications-lowstock"] });
      const verb =
        type === "IN" ? "Stock added" : type === "OUT" ? "Stock removed" : "Stock adjusted";
      toast.success(`${verb} · new quantity: ${newStock}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetAndClose = (o: boolean) => {
    if (!o) {
      // Reset on close so a re-open starts fresh.
      setType(initialMode);
      setReason(REASONS_BY_TYPE[initialMode][0].value);
      setQty("");
      setNote("");
      setPriceUpdateEnabled(false);
      setNewPurchasePrice("");
      setNewSellingPrice("");
    }
    onOpenChange(o);
  };

  const modeCards: {
    type: AdjustType;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    activeRing: string;
    text: string;
  }[] = [
    {
      type: "IN",
      label: "Add Stock",
      description: "Restock, returns, found items",
      icon: ArrowDownToLine,
      accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      activeRing:
        "ring-2 ring-emerald-500/60 border-emerald-500/40 bg-emerald-500/5",
      text: "text-emerald-600 dark:text-emerald-400",
    },
    {
      type: "OUT",
      label: "Remove Stock",
      description: "Lost, damaged, returned",
      icon: ArrowUpFromLine,
      accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      activeRing:
        "ring-2 ring-rose-500/60 border-rose-500/40 bg-rose-500/5",
      text: "text-rose-600 dark:text-rose-400",
    },
    {
      type: "ADJUST",
      label: "Set Quantity",
      description: "Physical count correction",
      icon: Scale,
      accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      activeRing:
        "ring-2 ring-amber-500/60 border-amber-500/40 bg-amber-500/5",
      text: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Adjust Stock
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            {product.name} · <span className="font-mono">{product.sku}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-5 px-6 py-5">
            {/* Current state card */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CurrentStat
                label="Current Stock"
                value={<StockBadge stock={stock} minStock={minStock} />}
                accent="bg-muted/40"
              />
              <CurrentStat
                label="Min Stock"
                value={<span className="text-sm font-bold">{minStock}</span>}
                accent="bg-muted/40"
              />
              <CurrentStat
                label="Cost Price"
                value={
                  <span className="text-sm font-bold">
                    {formatCurrency(purchasePrice)}
                  </span>
                }
                accent="bg-muted/40"
              />
              <CurrentStat
                label="Sell Price"
                value={
                  <span className="text-sm font-bold text-emerald-600">
                    {formatCurrency(sellingPrice)}
                  </span>
                }
                accent="bg-muted/40"
              />
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {modeCards.map((card) => {
                const isActive = type === card.type;
                const Icon = card.icon;
                return (
                  <button
                    type="button"
                    key={card.type}
                    onClick={() => setType(card.type)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-xl border bg-card p-3 text-left transition-all hover:bg-accent/40",
                      isActive ? card.activeRing : "border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg",
                          card.accent,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isActive ? card.text : "",
                        )}
                      >
                        {card.label}
                      </span>
                    </div>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {card.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Reason + qty */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-medium">
                  Reason
                </Label>
                <Select value={activeReason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS_BY_TYPE[type].map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium">
                  {type === "ADJUST"
                    ? "New Quantity (absolute)"
                    : "Quantity"}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder={
                    type === "ADJUST"
                      ? `e.g. ${Math.max(0, stock)}`
                      : "e.g. 10"
                  }
                />
                {type === "ADJUST" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Set stock to this exact number.
                  </p>
                )}
                {stockWillGoNegative && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
                    <AlertTriangle className="h-3 w-3" />
                    Not enough stock — available: {stock}
                  </p>
                )}
              </div>
            </div>

            {/* Optional price update (IN only) */}
            {type === "IN" && (
              <div className="rounded-xl border bg-muted/20 p-3">
                <button
                  type="button"
                  onClick={() => setPriceUpdateEnabled((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium">
                      Update purchase / selling price
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      priceUpdateEnabled
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {priceUpdateEnabled ? "On" : "Keep current"}
                  </span>
                </button>

                {priceUpdateEnabled && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="mb-1 block text-[11px] text-muted-foreground">
                          New Purchase Price
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={newPurchasePrice}
                          onChange={(e) => setNewPurchasePrice(e.target.value)}
                          placeholder={String(purchasePrice)}
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-[11px] text-muted-foreground">
                          New Selling Price
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={newSellingPrice}
                          onChange={(e) => setNewSellingPrice(e.target.value)}
                          placeholder={String(sellingPrice)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
                      <span className="text-muted-foreground">
                        Profit margin / unit
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-semibold",
                            margin > 0
                              ? "bg-emerald-500/10 text-emerald-600"
                              : margin < 0
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {marginPct}%
                        </Badge>
                        <span
                          className={cn(
                            "font-semibold",
                            margin > 0
                              ? "text-emerald-600"
                              : margin < 0
                                ? "text-rose-600"
                                : "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(margin)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium">
                Note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any context — invoice no, who returned it, where it was found…"
              />
            </div>

            {/* Live preview */}
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Live Preview
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <PreviewStat
                  label="Stock"
                  before={String(stock)}
                  after={String(newStock)}
                  delta={stockDelta}
                  unit="units"
                  tone={
                    stockDelta > 0
                      ? "emerald"
                      : stockDelta < 0
                        ? "rose"
                        : "muted"
                  }
                />
                <PreviewStat
                  label="Stock Value (retail)"
                  before={formatCurrency(oldValue)}
                  after={formatCurrency(newValue)}
                  delta={valueDelta}
                  tone={
                    valueDelta > 0
                      ? "emerald"
                      : valueDelta < 0
                        ? "rose"
                        : "muted"
                  }
                />
                <div className="rounded-lg border bg-muted/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    After
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <StockBadge stock={newStock} minStock={minStock} />
                    {newStock <= minStock && newStock > 0 && (
                      <span className="text-[10px] text-amber-600">
                        below min
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <Separator />
        <div className="flex items-center justify-between gap-2 px-6 py-3">
          <p className="text-[11px] text-muted-foreground">
            Reason:{" "}
            <span className="font-medium text-foreground">
              {activeReason.replace(/_/g, " ").toLowerCase()}
            </span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => resetAndClose(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {type === "IN"
                ? "Add Stock"
                : type === "OUT"
                  ? "Remove Stock"
                  : "Apply Adjustment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CurrentStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-2.5", accent)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function PreviewStat({
  label,
  before,
  after,
  delta,
  unit,
  tone,
}: {
  label: string;
  before: string;
  after: string;
  delta: number;
  unit?: string;
  tone: "emerald" | "rose" | "muted";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : "text-muted-foreground";
  const deltaStr =
    delta > 0 ? `+${delta}${unit ? ` ${unit}` : ""}` : delta < 0 ? `${delta}${unit ? ` ${unit}` : ""}` : "no change";
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xs text-muted-foreground line-through">{before}</span>
        <span className="text-[10px] text-muted-foreground">→</span>
        <span className="text-sm font-bold">{after}</span>
      </div>
      <p className={cn("mt-0.5 text-[11px] font-semibold", toneClass)}>
        {deltaStr}
      </p>
    </div>
  );
}
