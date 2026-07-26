"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import { PaymentStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Truck, Plus, Search, Star, Phone, MessageCircle, Mail, MapPin, User,
  Pencil, Trash2, Loader2, Save, Package, ShoppingCart, TrendingUp,
  Building2, Contact, Wallet,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────
interface Supplier {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  contactPerson: string | null;
  balance: number;
  rating: number;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  outstandingBalance: number;
  _count?: { purchases: number; products: number };
}

interface PurchaseItem {
  id: string;
  name: string;
  qty: number;
  cost: number;
  price: number;
  total: number;
  product?: { name: string; sku: string } | null;
}

interface Purchase {
  id: string;
  poNo: string;
  total: number;
  paid: number;
  paymentStatus: string;
  status: string;
  createdAt: string;
  notes: string | null;
  items: PurchaseItem[];
}

interface SuppliedProduct {
  id: string;
  sku: string;
  name: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  brand?: { name: string } | null;
  partType?: { name: string } | null;
}

interface PriceHistoryEntry {
  id: string;
  date: string;
  purchasePrice: number;
  sellingPrice: number;
  note: string | null;
  product: { name: string; sku: string };
}

interface SupplierDetail extends Supplier {
  purchases: Purchase[];
  products: SuppliedProduct[];
  priceHistory: PriceHistoryEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function sanitizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "").replace(/(^\+?)(\+)+/, "$1");
}

function whatsappLink(raw: string | null | undefined): string {
  const digits = sanitizePhone(raw).replace(/^\+/, "").replace(/^0+/, "");
  return `https://wa.me/${digits}`;
}

function telLink(raw: string | null | undefined): string {
  return `tel:${sanitizePhone(raw)}`;
}

// ─── Star Rating ─────────────────────────────────────────────────────────
function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={
            i < value
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40"
          }
        />
      ))}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────
export function SuppliersView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    return p.toString();
  }, [q]);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers", queryStr],
    queryFn: () => api.get<Supplier[]>(`/suppliers${queryStr ? `?${queryStr}` : ""}`),
  });

  // Stats
  const totalSuppliers = suppliers.length;
  const totalOutstanding = suppliers.reduce((s, x) => s + (x.outstandingBalance ?? 0), 0);
  const avgRating = totalSuppliers
    ? suppliers.reduce((s, x) => s + (x.rating ?? 0), 0) / totalSuppliers
    : 0;

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setFormOpen(true);
  };

  const onDelete = async (s: Supplier) => {
    if (!confirm(`Deactivate supplier "${s.name}"? This will hide them from selection lists.`)) return;
    try {
      await api.del(`/suppliers/${s.id}`);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deactivated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const columns: Column<Supplier>[] = [
    {
      key: "name", header: "Supplier", className: "min-w-[220px]",
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-primary/10 text-primary">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(s.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {s.company ?? "—"}{s.contactPerson ? ` · ${s.contactPerson}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone", header: "Phone / WhatsApp", className: "min-w-[180px]",
      render: (s) => (
        <div className="flex flex-col gap-0.5 text-xs">
          {s.phone ? (
            <a href={telLink(s.phone)} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
              <Phone className="h-3 w-3 text-muted-foreground" /> {s.phone}
            </a>
          ) : <span className="text-muted-foreground">No phone</span>}
          {s.whatsapp && (
            <a href={whatsappLink(s.whatsapp)} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 text-emerald-600 hover:underline"
               onClick={(e) => e.stopPropagation()}>
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          )}
        </div>
      ),
    },
    {
      key: "products", header: "Products", className: "text-center",
      render: (s) => (
        <div className="text-center">
          <p className="text-sm font-semibold">{s._count?.products ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">supplied</p>
        </div>
      ),
    },
    {
      key: "purchases", header: "Purchases", className: "text-center",
      render: (s) => (
        <div className="text-center">
          <p className="text-sm font-semibold">{s._count?.purchases ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">orders</p>
        </div>
      ),
    },
    {
      key: "outstanding", header: "Outstanding", className: "text-right",
      render: (s) => {
        const amt = s.outstandingBalance ?? 0;
        return (
          <div className="text-right">
            <p className={`text-sm font-semibold ${amt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
              {formatCurrency(amt)}
            </p>
            <p className="text-[11px] text-muted-foreground">{amt > 0 ? "payable" : "settled"}</p>
          </div>
        );
      },
    },
    {
      key: "rating", header: "Rating",
      render: (s) => (
        <div className="flex items-center gap-2">
          <StarRating value={s.rating ?? 0} />
          <span className="text-xs text-muted-foreground">{s.rating ?? 0}.0</span>
        </div>
      ),
    },
    {
      key: "actions", header: "", className: "text-right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); setDetailId(s.id); }}>View</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(s); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppliers"
        description="Manage vendors, track outstanding payables and rating performance"
        icon={Truck}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Supplier
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Suppliers"
          value={totalSuppliers}
          icon={Truck}
          accent="emerald"
          subtitle="Active vendors"
        />
        <StatCard
          label="Outstanding Payable"
          value={formatCurrency(totalOutstanding)}
          icon={Wallet}
          accent={totalOutstanding > 0 ? "rose" : "emerald"}
          subtitle="Across all suppliers"
        />
        <StatCard
          label="Average Rating"
          value={`${avgRating.toFixed(1)} / 5`}
          icon={Star}
          accent="amber"
          subtitle={totalSuppliers ? `${totalSuppliers} rated` : "No ratings yet"}
        />
      </div>

      {/* Search + Table */}
      <Card className="p-4 shadow-soft">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, company, phone, email…"
            className="pl-9"
          />
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={suppliers}
        loading={isLoading}
        onRowClick={(s) => setDetailId(s.id)}
        rowKey={(s) => s.id}
        emptyTitle="No suppliers found"
        emptyDescription={q ? "Try a different search term." : "Add your first supplier to start tracking purchases."}
      />

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editing}
      />

      <SupplierDetailSheet
        supplierId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={(s) => { setDetailId(null); openEdit(s); }}
      />
    </div>
  );
}

// ─── Supplier Form Dialog ────────────────────────────────────────────────
interface SupplierFormValues {
  id?: string;
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  contactPerson: string;
  rating: number;
  notes: string;
}

const emptyForm: SupplierFormValues = {
  name: "", company: "", phone: "", whatsapp: "", email: "",
  address: "", contactPerson: "", rating: 3, notes: "",
};

function SupplierFormDialog({
  open, onOpenChange, supplier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier: Supplier | null;
}) {
  // Keyed remount strategy: the inner form holds its own state initialized
  // from `supplier`. When `supplier` (or open state) changes, React remounts
  // the inner form, resetting state cleanly without setState-in-effect.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <SupplierFormInner
          key={open ? (supplier?.id ?? "new") : "closed"}
          supplier={supplier}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function SupplierFormInner({
  supplier, onOpenChange,
}: {
  supplier: Supplier | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SupplierFormValues>(() =>
    supplier
      ? {
          id: supplier.id,
          name: supplier.name,
          company: supplier.company ?? "",
          phone: supplier.phone ?? "",
          whatsapp: supplier.whatsapp ?? "",
          email: supplier.email ?? "",
          address: supplier.address ?? "",
          contactPerson: supplier.contactPerson ?? "",
          rating: supplier.rating ?? 3,
          notes: supplier.notes ?? "",
        }
      : emptyForm
  );

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, rating: Number(form.rating) };
      if (form.id) return api.put(`/suppliers/${form.id}`, body);
      return api.post("/suppliers", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(form.id ? "Supplier updated" : "Supplier created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof SupplierFormValues, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle>{form.id ? "Edit Supplier" : "New Supplier"}</DialogTitle>
      </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Supplier Name *">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. ABC Mobile Parts" />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Trading company" />
              </Field>
              <Field label="Contact Person">
                <Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} placeholder="Mr. John Doe" />
              </Field>
              <Field label="Rating">
                <Select value={String(form.rating)} onValueChange={(v) => set("rating", Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        <span className="flex items-center gap-1.5">
                          {n} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" />
              </Field>
              <Field label="WhatsApp">
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+92 300 1234567" />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@supplier.com" />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City, Country" />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Payment terms, delivery schedule, special instructions…" />
              </Field>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {form.id ? "Save Changes" : "Create Supplier"}
          </Button>
        </DialogFooter>
    </>
  );
}

// ─── Supplier Detail Sheet ───────────────────────────────────────────────
function SupplierDetailSheet({
  supplierId, onOpenChange, onEdit,
}: {
  supplierId: string | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (s: Supplier) => void;
}) {
  const open = !!supplierId;
  const { data: supplier, isLoading } = useQuery<SupplierDetail>({
    queryKey: ["supplier", supplierId],
    queryFn: () => api.get<SupplierDetail>(`/suppliers/${supplierId!}`),
    enabled: !!supplierId,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {supplier && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-12 w-12 bg-primary/10 text-primary">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {initials(supplier.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="text-base">{supplier.name}</SheetTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {supplier.company && (
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {supplier.company}</span>
                      )}
                      {supplier.contactPerson && (
                        <span className="inline-flex items-center gap-1"><Contact className="h-3 w-3" /> {supplier.contactPerson}</span>
                      )}
                      {!supplier.active && <Badge variant="outline" className="text-rose-600">Inactive</Badge>}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(supplier)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-90px)]">
              <div className="px-6 py-5">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border p-3">
                    <p className="text-[11px] text-muted-foreground">Outstanding</p>
                    <p className={`mt-1 text-lg font-bold ${(supplier.outstandingBalance ?? 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                      {formatCurrency(supplier.outstandingBalance ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[11px] text-muted-foreground">Purchases</p>
                    <p className="mt-1 text-lg font-bold">{supplier._count?.purchases ?? supplier.purchases?.length ?? 0}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[11px] text-muted-foreground">Products</p>
                    <p className="mt-1 text-lg font-bold">{supplier._count?.products ?? supplier.products?.length ?? 0}</p>
                  </div>
                </div>

                {/* Contact info */}
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {supplier.phone && (
                    <a href={telLink(supplier.phone)} className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Phone className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Phone</p>
                        <p className="truncate text-sm font-medium">{supplier.phone}</p>
                      </div>
                    </a>
                  )}
                  {supplier.whatsapp && (
                    <a href={whatsappLink(supplier.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><MessageCircle className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">WhatsApp</p>
                        <p className="truncate text-sm font-medium">{supplier.whatsapp}</p>
                      </div>
                    </a>
                  )}
                  {supplier.email && (
                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600"><Mail className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Email</p>
                        <p className="truncate text-sm font-medium">{supplier.email}</p>
                      </div>
                    </a>
                  )}
                  {supplier.address && (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><MapPin className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Address</p>
                        <p className="truncate text-sm font-medium">{supplier.address}</p>
                      </div>
                    </div>
                  )}
                  {supplier.contactPerson && (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600"><User className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Contact Person</p>
                        <p className="truncate text-sm font-medium">{supplier.contactPerson}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /></div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">Rating</p>
                      <div className="mt-0.5"><StarRating value={supplier.rating ?? 0} /></div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {supplier.notes && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="mb-1 text-xs font-semibold text-amber-600">Notes</p>
                    <p className="text-sm">{supplier.notes}</p>
                  </div>
                )}

                {/* Tabs */}
                <Tabs defaultValue="purchases" className="mt-5">
                  <TabsList className="mb-4">
                    <TabsTrigger value="purchases">Purchases</TabsTrigger>
                    <TabsTrigger value="products">Products Supplied</TabsTrigger>
                    <TabsTrigger value="prices">Price History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="purchases">
                    {!supplier.purchases?.length ? (
                      <EmptyState icon={ShoppingCart} title="No purchases yet" description="Purchase orders from this supplier will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {supplier.purchases.map((p) => (
                          <div key={p.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold">{p.poNo}</p>
                                  <PaymentStatusBadge status={p.paymentStatus} />
                                  <Badge variant="secondary" className="text-[10px]">{p.status}</Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{formatDateTime(p.createdAt)} · {p.items?.length ?? 0} items</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{formatCurrency(p.total)}</p>
                                <p className="text-[11px] text-muted-foreground">paid {formatCurrency(p.paid)}</p>
                              </div>
                            </div>
                            {p.items?.length > 0 && (
                              <div className="mt-2 space-y-1 border-t pt-2">
                                {p.items.map((it) => (
                                  <div key={it.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="truncate">{it.name} <span className="text-[10px]">×{it.qty}</span></span>
                                    <span className="font-medium text-foreground">{formatCurrency(it.total)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="products">
                    {!supplier.products?.length ? (
                      <EmptyState icon={Package} title="No products supplied" description="Products linked to this supplier will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {supplier.products.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Package className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">{p.sku}{p.brand?.name ? ` · ${p.brand.name}` : ""}{p.partType?.name ? ` · ${p.partType.name}` : ""}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-600">{formatCurrency(p.sellingPrice)}</p>
                              <p className="text-[11px] text-muted-foreground">stock {p.stock}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="prices">
                    {!supplier.priceHistory?.length ? (
                      <EmptyState icon={TrendingUp} title="No price history" description="Price changes recorded for products from this supplier will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {supplier.priceHistory.map((h) => (
                          <div key={h.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{h.product.name}</p>
                              <p className="text-[11px] text-muted-foreground">{h.product.sku} · {formatDate(h.date)}{h.note ? ` · ${h.note}` : ""}</p>
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
                </Tabs>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Small Field helper ──────────────────────────────────────────────────
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
