"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, ShoppingCart, Layers, Check, X, ChevronRight, ImageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";

interface QualityGroup {
  quality: string;
  totalStock: number;
  products: any[];
  shelves: string[];
}

interface PartGroup {
  partType: string;
  fitsModels: string[];
  qualities: QualityGroup[];
  bestPrice: number;
  image: string | null;
}

interface CompatibilityResultsProps {
  matchedModels: { id: string; name: string; brand?: string }[];
  compatibleModels: { id: string; name: string; brand?: string; partType: string }[];
  partGroups: PartGroup[];
  onSellProduct?: (p: any) => void;
  onQuickSell?: (p: any) => void;
  onViewProduct?: (p: any) => void;
}

const qualityStyles: Record<string, string> = {
  ORIGINAL: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  OEM: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  COPY: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PREMIUM_COPY: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  REFURBISHED: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

export function CompatibilityResults({
  matchedModels,
  compatibleModels,
  partGroups,
  onSellProduct,
  onQuickSell,
  onViewProduct,
}: CompatibilityResultsProps) {
  const [selectedPartType, setSelectedPartType] = useState<string | null>(null);

  const primaryModel = matchedModels[0];

  return (
    <div className="mt-8 space-y-8">
      {/* Phone model header — large, clear */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Package className="h-4 w-4" />
          Phone Model
        </div>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">{primaryModel?.name ?? "Unknown"}</h2>
        {primaryModel?.brand && (
          <p className="mt-1 text-lg text-muted-foreground">{primaryModel.brand}</p>
        )}

        {/* Compatible models — prominent */}
        {compatibleModels.length > 0 && (
          <div className="mt-5 border-t pt-5">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Layers className="h-4 w-4" /> All these phones use the same parts:
            </p>
            <div className="flex flex-wrap gap-2">
              {matchedModels.map((m) => (
                <span key={m.id} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                  {m.name}
                </span>
              ))}
              {compatibleModels.map((m) => (
                <span key={m.id} className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Part groups — each shows what fits + availability */}
      {partGroups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-xl font-semibold">No parts in stock for this model</h3>
          <p className="mt-1 text-base text-muted-foreground">Check back after restocking.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {partGroups.map((group) => {
            const totalStock = group.qualities.reduce((s, q) => s + q.totalStock, 0);
            const inStock = totalStock > 0;
            const bestQuality = group.qualities.find((q) => q.totalStock > 0);
            const sellProduct = bestQuality?.products[0];

            return (
              <div key={group.partType} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
                {/* Part type header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold tracking-tight">{group.partType}</h3>
                    <span className="text-sm text-muted-foreground">Required</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {inStock ? (
                      <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-600">
                        <Check className="h-4 w-4" /> In Stock
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-600">
                        <X className="h-4 w-4" /> Out of Stock
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 p-6 sm:grid-cols-[200px_1fr]">
                  {/* Image + fits models */}
                  <div>
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                      {group.image ? (
                        <img src={group.image} alt={group.partType} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    {group.fitsModels.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fits</p>
                        <p className="text-sm font-medium leading-relaxed">{group.fitsModels.join(", ")}</p>
                      </div>
                    )}
                  </div>

                  {/* Qualities — large, clear availability per quality */}
                  <div className="space-y-3">
                    {group.qualities.map((qg) => {
                      const qInStock = qg.totalStock > 0;
                      const firstProduct = qg.products[0];
                      return (
                        <div
                          key={qg.quality}
                          className={cn(
                            "flex items-center gap-4 rounded-xl border p-4 transition",
                            qInStock ? "bg-card" : "bg-muted/30 opacity-60"
                          )}
                        >
                          {/* Quality badge */}
                          <span className={cn(
                            "w-32 shrink-0 rounded-lg border px-3 py-2 text-center text-sm font-bold",
                            qualityStyles[qg.quality] ?? "bg-muted text-muted-foreground"
                          )}>
                            {qg.quality.replace("_", " ")}
                          </span>

                          {/* Stock */}
                          <div className="shrink-0">
                            <p className="text-xs font-medium text-muted-foreground">Stock</p>
                            <p className={cn(
                              "text-xl font-bold",
                              !qInStock ? "text-rose-500" : qg.totalStock <= 5 ? "text-amber-500" : "text-emerald-600"
                            )}>
                              {qg.totalStock}
                            </p>
                          </div>

                          {/* Shelves */}
                          <div className="hidden shrink-0 sm:block">
                            <p className="text-xs font-medium text-muted-foreground">Shelf</p>
                            <p className="flex items-center gap-1 text-base font-semibold">
                              <MapPin className="h-4 w-4 text-primary" />
                              {qg.shelves.join(", ") || "—"}
                            </p>
                          </div>

                          {/* Price */}
                          <div className="ml-auto shrink-0 text-right">
                            <p className="text-xs font-medium text-muted-foreground">Price</p>
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(firstProduct?.sellingPrice ?? group.bestPrice)}</p>
                          </div>

                          {/* Sell button */}
                          <Button
                            size="lg"
                            className="h-12 shrink-0 px-6 text-base font-semibold"
                            disabled={!qInStock}
                            onClick={() => onQuickSell?.(firstProduct)}
                          >
                            <ShoppingCart className="mr-1.5 h-5 w-5" />
                            Sell
                          </Button>
                        </div>
                      );
                    })}

                    {/* View details link */}
                    {sellProduct && (
                      <button
                        onClick={() => onViewProduct?.(sellProduct)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View product details <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
