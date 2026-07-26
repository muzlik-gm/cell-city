"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QualityBadge, StockBadge } from "@/components/shared/badges";
import { Package, MapPin, Tag, Users, ShoppingCart, ArrowDownToLine, QrCode, History, Edit } from "lucide-react";
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
  className?: string;
}

export function SmartProductCard({ product: p, onSell, onEdit, onHistory, onPrintQR, onReceive, className }: SmartProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const profit = p.sellingPrice - p.purchasePrice;

  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:shadow-lg", className)}>
      {/* Top: image + key info */}
      <div className="flex gap-3 p-3">
        {/* Image */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {p.images?.[0]?.url && !imgError ? (
            <img
              src={p.images[0].url}
              alt={p.name}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-7 w-7 text-muted-foreground/50" />
            </div>
          )}
          {p.partType && (
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white backdrop-blur">
              {p.partType.name}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <QualityBadge quality={p.quality} />
            <StockBadge stock={p.stock} minStock={p.minStock} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.shelf?.code ?? "—"}</span>
            <span className="flex items-center gap-0.5"><Tag className="h-3 w-3" />{formatCurrency(p.sellingPrice)}</span>
          </div>
        </div>
      </div>

      {/* Compatible models */}
      {p.compatibleModels && p.compatibleModels.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Compatible with</p>
          <div className="flex flex-wrap gap-1">
            {p.compatibleModels.slice(0, 4).map((m, i) => (
              <span key={i} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {m.name}
              </span>
            ))}
            {p.compatibleModels.length > 4 && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{p.compatibleModels.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Price + supplier */}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Profit/unit</p>
          <p className="text-xs font-semibold text-emerald-600">{formatCurrency(profit)}</p>
        </div>
        {p.supplier && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Supplier</p>
            <p className="max-w-[100px] truncate text-[11px] font-medium">{p.supplier.name}</p>
          </div>
        )}
      </div>

      {/* Quick actions — always visible */}
      <div className="grid grid-cols-5 gap-px border-t bg-muted/40">
        <button
          onClick={() => onSell?.(p)}
          className="flex flex-col items-center gap-0.5 bg-card py-2 text-[10px] font-medium text-primary transition hover:bg-primary/5"
        >
          <ShoppingCart className="h-4 w-4" />
          Sell
        </button>
        <div className="bg-card">
          <button
            onClick={() => onReceive?.(p)}
            className="flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-emerald-600 transition hover:bg-emerald-500/5"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Receive
          </button>
        </div>
        <button
          onClick={() => onPrintQR?.(p)}
          className="flex flex-col items-center gap-0.5 bg-card py-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted/50"
        >
          <QrCode className="h-4 w-4" />
          QR
        </button>
        <button
          onClick={() => onEdit?.(p)}
          className="flex flex-col items-center gap-0.5 bg-card py-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted/50"
        >
          <Edit className="h-4 w-4" />
          Edit
        </button>
        <button
          onClick={() => onHistory?.(p)}
          className="flex flex-col items-center gap-0.5 bg-card py-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted/50"
        >
          <History className="h-4 w-4" />
          History
        </button>
      </div>
    </div>
  );
}
