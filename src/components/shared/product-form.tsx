"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageGalleryUpload } from "@/components/shared/image-upload";
import { QUALITIES, CONDITIONS } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export interface ProductFormValues {
  id?: string;
  name: string;
  sku: string;
  barcode?: string;
  brandId?: string;
  modelId?: string;
  partTypeId?: string;
  quality: string;
  condition: string;
  color?: string;
  supplierId?: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  warehouseId?: string;
  shelfId?: string;
  connectorType?: string;
  lcdCode?: string;
  warranty?: string;
  notes?: string;
  images: { url: string; kind?: string }[];
}

const empty: ProductFormValues = {
  name: "", sku: "", barcode: "", quality: "ORIGINAL", condition: "NEW",
  color: "", purchasePrice: 0, sellingPrice: 0, stock: 0, minStock: 5,
  connectorType: "", lcdCode: "", warranty: "", notes: "", images: [],
};

export function ProductFormDialog({
  open, onOpenChange, product,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: any;
}) {
  // Keyed remount: a fresh inner form is mounted whenever the target product changes
  // (or when creating a new one), so initial state is derived lazily — no setState-in-effect.
  return (
    <ProductFormInner
      key={product?.id ?? "new"}
      open={open}
      onOpenChange={onOpenChange}
      product={product}
    />
  );
}

function ProductFormInner({
  open, onOpenChange, product,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: any;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>(() =>
    product
      ? {
          id: product.id, name: product.name, sku: product.sku, barcode: product.barcode ?? "",
          brandId: product.brandId ?? "", modelId: product.modelId ?? "", partTypeId: product.partTypeId ?? "",
          quality: product.quality, condition: product.condition, color: product.color ?? "",
          supplierId: product.supplierId ?? "", purchasePrice: product.purchasePrice, sellingPrice: product.sellingPrice,
          stock: product.stock, minStock: product.minStock, warehouseId: product.warehouseId ?? "",
          shelfId: product.shelfId ?? "", connectorType: product.connectorType ?? "", lcdCode: product.lcdCode ?? "",
          warranty: product.warranty ?? "", notes: product.notes ?? "",
          images: (product.images ?? []).map((i: any) => ({ url: i.url, kind: i.kind })),
        }
      : empty
  );

  const brands = useQuery({ queryKey: ["brands"], queryFn: () => api.get<any[]>("/brands") });
  const models = useQuery({
    queryKey: ["models", form.brandId],
    queryFn: () => api.get<any[]>(`/models${form.brandId ? `?brandId=${form.brandId}` : ""}`),
  });
  const partTypes = useQuery({ queryKey: ["part-types"], queryFn: () => api.get<any[]>("/part-types") });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get<any[]>("/suppliers") });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: () => api.get<any[]>("/warehouses") });
  const shelves = useQuery({
    queryKey: ["shelves", form.warehouseId],
    queryFn: () => api.get<any[]>(`/shelves${form.warehouseId ? `?warehouseId=${form.warehouseId}` : ""}`),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice), stock: Number(form.stock), minStock: Number(form.minStock) };
      if (form.id) return api.put(`/products/${form.id}`, body);
      return api.post("/products", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dash-summary"] });
      toast.success(form.id ? "Product updated" : "Product created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof ProductFormValues, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{form.id ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 py-5">
            <Tabs defaultValue="basic">
              <TabsList className="mb-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="pricing">Pricing & Stock</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Product Name *">
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Samsung A12 LCD Original" />
                  </Field>
                  <Field label="SKU *">
                    <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="MSP-1001" />
                  </Field>
                  <Field label="Brand">
                    <Select value={form.brandId} onValueChange={(v) => { set("brandId", v); set("modelId", ""); }}>
                      <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                      <SelectContent>{(brands.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Phone Model">
                    <Select value={form.modelId} onValueChange={(v) => set("modelId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                      <SelectContent>{(models.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Part Type">
                    <Select value={form.partTypeId} onValueChange={(v) => set("partTypeId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select part type" /></SelectTrigger>
                      <SelectContent>{(partTypes.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Quality">
                    <Select value={form.quality} onValueChange={(v) => set("quality", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{QUALITIES.map((q) => <SelectItem key={q} value={q}>{q.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Condition">
                    <Select value={form.condition} onValueChange={(v) => set("condition", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Color">
                    <Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Black" />
                  </Field>
                  <Field label="Barcode">
                    <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="89012345..." />
                  </Field>
                  <Field label="LCD Code">
                    <Input value={form.lcdCode} onChange={(e) => set("lcdCode", e.target.value)} placeholder="SA-1001" />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Purchase Price">
                    <Input type="number" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} />
                  </Field>
                  <Field label="Selling Price">
                    <Input type="number" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} />
                  </Field>
                  <Field label="Stock Quantity">
                    <Input type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
                  </Field>
                  <Field label="Minimum Stock">
                    <Input type="number" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} />
                  </Field>
                  <Field label="Supplier">
                    <Select value={form.supplierId} onValueChange={(v) => set("supplierId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{(suppliers.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Warranty">
                    <Input value={form.warranty} onChange={(e) => set("warranty", e.target.value)} placeholder="3 months" />
                  </Field>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Profit per unit</span><span className="font-semibold text-emerald-600">{formatCurrency2(Number(form.sellingPrice) - Number(form.purchasePrice))}</span></div>
                  <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Stock value (cost)</span><span className="font-semibold">{formatCurrency2(Number(form.purchasePrice) * Number(form.stock))}</span></div>
                  <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Potential revenue</span><span className="font-semibold">{formatCurrency2(Number(form.sellingPrice) * Number(form.stock))}</span></div>
                </div>
              </TabsContent>

              <TabsContent value="location" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Warehouse">
                    <Select value={form.warehouseId} onValueChange={(v) => { set("warehouseId", v); set("shelfId", ""); }}>
                      <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                      <SelectContent>{(warehouses.data ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Shelf / Bin">
                    <Select value={form.shelfId} onValueChange={(v) => set("shelfId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select shelf" /></SelectTrigger>
                      <SelectContent>{(shelves.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.code}{s.description ? ` · ${s.description}` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Connector Type" className="sm:col-span-2">
                    <Input value={form.connectorType} onChange={(e) => set("connectorType", e.target.value)} placeholder="J1, 6-pin, etc." />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="images" className="space-y-3">
                <p className="text-xs text-muted-foreground">Upload front, back, connector, flex, IC and packaging images.</p>
                <ImageGalleryUpload images={form.images} onChange={(imgs) => set("images", imgs)} />
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Field label="Notes">
                  <Textarea rows={5} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Fragile connector. Version 3 only. High return rate..." />
                </Field>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.sku}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {form.id ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function formatCurrency2(n: number) {
  return `Rs ${new Intl.NumberFormat("en-US").format(Math.round(n || 0))}`;
}
