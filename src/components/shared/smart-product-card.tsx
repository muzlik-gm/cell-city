"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, MapPin, ShoppingCart, ArrowDownToLine, QrCode, History, Edit, Layers, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";

interface Product {
  id: string;
  sku: string;
  name: string;
  quality: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  sellingPrice: number;
  color?: string | null;
  shelf?: { code: string } | null;
  warehouse?: { name: string } | null;
  brand?: { name: string } | null;
  model?: { name: string } | null;
  partType?: { name: string } | null;
  supplier?: { name: string } | null;
  images?: { url: string }[];
  compatibleModels?: { name: string; brand?: string }[];
}

interface SmartProductCardProps {
  product: Product;
  onSell?: (p: Product) => void;
  onEdit?: (p: Product) => void;
  onHistory?: (p: Product) => void;
  onPrintQR?: (p: Product) => void;
  onReceive?: (p: Product) => void;
  onQuickSell?: (p: Product) => void;
  className?: string;
}

const qualityStyles: Record<string, string> = {
  ORIGINAL: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  OEM: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  COPY: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PREMIUM_COPY: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  REFURBISHED: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

export function SmartProductCard({ product: p, onSell, onEdit, onHistory, onPrintQR, onReceive, onQuickSell, className }: SmartProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const profit = p.sellingPrice - p.purchasePrice;
  const outOfStock = p.stock <= 0;
  const lowStock = p.stock > 0 && p.stock <= p.minStock;

  return (
    <div className={cn("group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:shadow-lg", className)}>
      {/* Large product image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {p.images?.[0]?.url && !imgError ? (
          <img
            src={p.images[0].url}
            alt={p.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        {/* Part type badge — top left */}
        {p.partType && (
          <span className="absolute left-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 text-sm font-semibold text-white backdrop-blur">
            {p.partType.name}
          </span>
        )}
        {/* Quality badge — top right */}
        {p.quality && (
          <span className={cn("absolute right-3 top-3 rounded-lg border px-2.5 py-1 text-sm font-semibold backdrop-blur", qualityStyles[p.quality] ?? "bg-black/60 text-white")}>
            {p.quality.replace("_", " ")}
          </span>
        )}
        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-lg bg-rose-500 px-4 py-2 text-base font-bold text-white">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Card body — generous padding */}
      <div className="flex flex-1 flex-col p-5">
        {/* Product name — large, bold */}
        <h3 className="line-clamp-2 text-xl font-bold leading-tight">{p.name}</h3>

        {/* Brand · Model */}
        {(p.brand || p.model) && (
          <p className="mt-1.5 text-base text-muted-foreground">
            {p.brand?.name}{p.brand && p.model ? " · " : ""}{p.model?.name}
          </p>
        )}

        {/* Stock + Price — large, prominent */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Stock</p>
            <p className={cn(
              "text-2xl font-bold leading-none",
              outOfStock ? "text-rose-500" : lowStock ? "text-amber-500" : "text-emerald-600"
            )}>
              {p.stock}
              <span className="ml-1 text-base font-medium text-muted-foreground">units</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">Price</p>
            <p className="text-2xl font-bold leading-none text-emerald-600">{formatCurrency(p.sellingPrice)}</p>
          </div>
        </div>

        {/* Shelf location — large, easy to find */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3">
          <MapPin className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shelf</p>
            <p className="text-lg font-bold">{p.shelf?.code ?? "—"}<span className="ml-2 text-sm font-normal text-muted-foreground">{p.warehouse?.name?.split(" ")[0] ?? ""}</span></p>
          </div>
        </div>

        {/* Compatible models */}
        {p.compatibleModels && p.compatibleModels.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Layers className="h-4 w-4" /> Compatible with
            </p>
            <div className="flex flex-wrap gap-1.5">
              {p.compatibleModels.slice(0, 3).map((m, i) => (
                <span key={i} className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                  {m.name}
                </span>
              ))}
              {p.compatibleModels.length > 3 && (
                <span className="rounded-lg bg-muted px-2.5 py-1 text-sm text-muted-foreground">
                  +{p.compatibleModels.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Primary action — Sell (large, full-width) */}
        <div className="mt-5">
          <Button
            size="lg"
            className="h-14 w-full gap-2 text-base font-semibold"
            disabled={outOfStock}
            onClick={() => (onQuickSell ?? onSell)?.(p)}
          >
            <ShoppingCart className="h-5 w-5" />
            Sell Now
          </Button>
        </div>

        {/* Secondary actions — large, full-width row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button
            onClick={() => onReceive?.(p)}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card text-sm font-medium text-emerald-600 transition hover:bg-emerald-500/5"
          >
            <ArrowDownToLine className="h-5 w-5" />
            Receive
          </button>
          <button
            onClick={() => onPrintQR?.(p)}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card text-sm font-medium text-muted-foreground transition hover:bg-muted/50"
          >
            <QrCode className="h-5 w-5" />
            QR
          </button>
          <button
            onClick={() => onEdit?.(p)}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card text-sm font-medium text-muted-foreground transition hover:bg-muted/50"
          >
            <Edit className="h-5 w-5" />
            Edit
          </button>
          <button
            onClick={() => onHistory?.(p)}
            className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border bg-card text-sm font-medium text-muted-foreground transition hover:bg-muted/50"
          >
            <History className="h-5 w-5" />
            History
          </button>
        </div>
      </div>
    </div>
  );
}
