"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrDisplay, BarcodeDisplay } from "@/components/shared/qr-barcode";
import { QualityBadge, StockBadge, ConditionBadge } from "@/components/shared/badges";
import { StockAdjustDialog } from "@/components/shared/stock-adjust-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Pencil, Package, TrendingUp, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/shared/states";

export function ProductDetailSheet({
  product, onOpenChange, onEdit,
}: {
  product: any;
  onOpenChange: (o: boolean) => void;
  onEdit: (p: any) => void;
}) {
  const qc = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const open = !!product;
  const detail = useQuery({
    queryKey: ["product", product?.id],
    queryFn: () => api.get<any>(`/products/${product?.id}`),
    enabled: !!product?.id,
  });

  const p = detail.data ?? product;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {p && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-base">{p.name}</SheetTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.sku} · {p.barcode ?? "No barcode"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setAdjustOpen(true)}
                    title="Adjust stock"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust Stock
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              </div>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-80px)]">
              <div className="px-6 py-5">
                <Tabs defaultValue="overview">
                  <TabsList className="mb-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="images">Images</TabsTrigger>
                    <TabsTrigger value="codes">QR / Barcode</TabsTrigger>
                    <TabsTrigger value="history">Price History</TabsTrigger>
                    <TabsTrigger value="movements">Movements</TabsTrigger>
                  </TabsList>

                  {/* Overview */}
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Info label="Brand" value={p.brand?.name} />
                      <Info label="Model" value={p.model?.name} />
                      <Info label="Part Type" value={<Badge variant="secondary">{p.partType?.name}</Badge>} />
                      <Info label="Supplier" value={p.supplier?.name} />
                      <Info label="Quality" value={<QualityBadge quality={p.quality} />} />
                      <Info label="Condition" value={<ConditionBadge condition={p.condition} />} />
                      <Info label="Color" value={p.color} />
                      <Info label="Connector" value={p.connectorType} />
                      <Info label="LCD Code" value={p.lcdCode} />
                      <Info label="Warranty" value={p.warranty} />
                      <Info label="Warehouse" value={p.warehouse?.name} />
                      <Info label="Shelf" value={p.shelf?.code} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border p-3">
                        <p className="text-[11px] text-muted-foreground">Stock</p>
                        <p className="mt-1 text-lg font-bold"><StockBadge stock={p.stock} minStock={p.minStock} /></p>
                      </div>
                      <div className="rounded-xl border p-3">
                        <p className="text-[11px] text-muted-foreground">Cost Price</p>
                        <p className="mt-1 text-lg font-bold">{formatCurrency(p.purchasePrice)}</p>
                      </div>
                      <div className="rounded-xl border p-3">
                        <p className="text-[11px] text-muted-foreground">Sell Price</p>
                        <p className="mt-1 text-lg font-bold text-emerald-600">{formatCurrency(p.sellingPrice)}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Profit / unit</span>
                        <span className="font-semibold text-emerald-600">{formatCurrency(p.sellingPrice - p.purchasePrice)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Stock value (retail)</span>
                        <span className="font-semibold">{formatCurrency(p.sellingPrice * p.stock)}</span>
                      </div>
                    </div>

                    {p.notes && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                        <p className="mb-1 text-xs font-semibold text-amber-600">Notes</p>
                        <p className="text-sm">{p.notes}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Images */}
                  <TabsContent value="images">
                    {(!p.images || p.images.length === 0) ? (
                      <EmptyState icon={Package} title="No images" description="Upload product images to help identification." />
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {p.images.map((img: any, i: number) => (
                          <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                            { }
                            <img src={img.url} alt={img.kind} className="h-full w-full object-cover" />
                            <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{img.kind}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* QR / Barcode */}
                  <TabsContent value="codes" className="space-y-4">
                    <div className="flex flex-col items-center gap-3 rounded-xl border p-6">
                      <p className="text-xs font-medium text-muted-foreground">QR Code</p>
                      <QrDisplay value={p.sku} size={180} />
                      <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    {p.barcode && (
                      <div className="flex flex-col items-center gap-3 rounded-xl border p-6">
                        <p className="text-xs font-medium text-muted-foreground">Barcode</p>
                        <BarcodeDisplay value={p.barcode} height={56} />
                      </div>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => window.print()}>
                      Print Labels
                    </Button>
                  </TabsContent>

                  {/* Price History */}
                  <TabsContent value="history">
                    {(!p.priceHistory || p.priceHistory.length === 0) ? (
                      <EmptyState icon={TrendingUp} title="No price history" />
                    ) : (
                      <div className="space-y-2">
                        {p.priceHistory.map((h: any) => (
                          <div key={h.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-xs font-medium">{formatDate(h.date)}</p>
                              <p className="text-[11px] text-muted-foreground">{h.supplier?.name ?? "—"} · {h.note ?? "—"}</p>
                            </div>
                            <div className="text-right text-xs">
                              <p>Cost <span className="font-semibold">{formatCurrency(h.purchasePrice)}</span></p>
                              <p>Sell <span className="font-semibold text-emerald-600">{formatCurrency(h.sellingPrice)}</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Movements */}
                  <TabsContent value="movements">
                    {(!p.movements || p.movements.length === 0) ? (
                      <EmptyState icon={ArrowDownToLine} title="No movements" />
                    ) : (
                      <div className="space-y-2">
                        {p.movements.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.type === "IN" || m.type === "PURCHASE" ? "bg-emerald-500/10 text-emerald-600" : m.type === "OUT" || m.type === "SALE" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}>
                              {m.type === "IN" || m.type === "PURCHASE" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold">{m.type} · {m.qty} units</p>
                              <p className="text-[11px] text-muted-foreground">{m.note ?? "—"} · {formatDateTime(m.date)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            <StockAdjustDialog
              product={adjustOpen ? p : null}
              open={adjustOpen}
              onOpenChange={(o) => {
                setAdjustOpen(o);
                if (!o) {
                  qc.invalidateQueries({ queryKey: ["product", p.id] });
                }
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}
