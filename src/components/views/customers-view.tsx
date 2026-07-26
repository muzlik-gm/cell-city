"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import { PaymentStatusBadge, RepairStatusBadge } from "@/components/shared/badges";
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
import {
  Users, Plus, Search, Phone, MessageCircle, Mail, MapPin, Building2,
  Pencil, Trash2, Loader2, Save, ShoppingCart, Wrench, Wallet,
  RotateCcw, Receipt, FileText, Clock,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/format";
import { toast } from "sonner";
import { StatementDialog } from "@/components/shared/statement-dialog";
import { ActivityTimeline } from "@/components/shared/activity-timeline";

// ─── Types ───────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  company: string | null;
  balance: number;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  outstandingBalance: number;
  _count?: { sales: number; repairJobs: number };
}

interface SaleItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  product?: { name: string; sku: string } | null;
}

interface Sale {
  id: string;
  invoiceNo: string;
  total: number;
  paid: number;
  profit: number;
  paymentStatus: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  items: SaleItem[];
}

interface RepairJob {
  id: string;
  ticketNo: string;
  problem: string;
  status: string;
  paymentStatus: string;
  total: number;
  paid: number;
  createdAt: string;
  model?: { name: string; brand?: { name: string } | null } | null;
}

interface CustomerDetail extends Customer {
  sales: Sale[];
  repairJobs: RepairJob[];
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

// ─── Main View ───────────────────────────────────────────────────────────
export function CustomersView() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    return p.toString();
  }, [q]);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["customers", queryStr],
    queryFn: () => api.get<Customer[]>(`/customers${queryStr ? `?${queryStr}` : ""}`),
  });

  // Stats
  const totalCustomers = customers.length;
  const totalOutstanding = customers.reduce((s, c) => s + (c.outstandingBalance ?? 0), 0);
  const returning = customers.filter(
    (c) => (c._count?.sales ?? 0) + (c._count?.repairJobs ?? 0) >= 2
  ).length;

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setFormOpen(true); };

  const onDelete = async (c: Customer) => {
    if (!confirm(`Deactivate customer "${c.name}"? This will hide them from selection lists.`)) return;
    try {
      await api.del(`/customers/${c.id}`);
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deactivated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: "name", header: "Customer", className: "min-w-[220px]",
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 bg-primary/10 text-primary">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(c.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{c.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {c.company ?? "—"}{c.email ? ` · ${c.email}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone", header: "Phone / WhatsApp", className: "min-w-[170px]",
      render: (c) => (
        <div className="flex flex-col gap-0.5 text-xs">
          {c.phone ? (
            <a href={telLink(c.phone)} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
              <Phone className="h-3 w-3 text-muted-foreground" /> {c.phone}
            </a>
          ) : <span className="text-muted-foreground">No phone</span>}
          {c.whatsapp && (
            <a href={whatsappLink(c.whatsapp)} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 text-emerald-600 hover:underline"
               onClick={(e) => e.stopPropagation()}>
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          )}
        </div>
      ),
    },
    {
      key: "purchases", header: "Purchases", className: "text-center",
      render: (c) => (
        <div className="text-center">
          <p className="text-sm font-semibold">{c._count?.sales ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">orders</p>
        </div>
      ),
    },
    {
      key: "repairs", header: "Repairs", className: "text-center",
      render: (c) => (
        <div className="text-center">
          <p className="text-sm font-semibold">{c._count?.repairJobs ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">jobs</p>
        </div>
      ),
    },
    {
      key: "outstanding", header: "Outstanding", className: "text-right",
      render: (c) => {
        const amt = c.outstandingBalance ?? 0;
        return (
          <div className="text-right">
            <p className={`text-sm font-semibold ${amt > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
              {formatCurrency(amt)}
            </p>
            <p className="text-[11px] text-muted-foreground">{amt > 0 ? "receivable" : "settled"}</p>
          </div>
        );
      },
    },
    {
      key: "actions", header: "", className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); setDetailId(c.id); }}>View</Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(c); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Manage buyers, track receivables, purchase and repair history"
        icon={Users}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={totalCustomers}
          icon={Users}
          accent="emerald"
          subtitle="Active buyers"
        />
        <StatCard
          label="Outstanding Receivable"
          value={formatCurrency(totalOutstanding)}
          icon={Wallet}
          accent={totalOutstanding > 0 ? "amber" : "emerald"}
          subtitle="Across all customers"
        />
        <StatCard
          label="Returning Customers"
          value={returning}
          icon={RotateCcw}
          accent="teal"
          subtitle={totalCustomers ? `${Math.round((returning / totalCustomers) * 100)}% of base` : "No data yet"}
        />
      </div>

      {/* Search */}
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
        data={customers}
        loading={isLoading}
        onRowClick={(c) => setDetailId(c.id)}
        rowKey={(c) => c.id}
        emptyTitle="No customers found"
        emptyDescription={q ? "Try a different search term." : "Add your first customer to start tracking sales & repairs."}
      />

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
      />

      <CustomerDetailSheet
        customerId={detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={(c) => { setDetailId(null); openEdit(c); }}
        onViewStatement={(c) => setStatementId(c.id)}
      />

      <StatementDialog
        partyType="customer"
        partyId={statementId ?? ""}
        partyName={
          customers.find((c) => c.id === statementId)?.name ?? "Customer"
        }
        open={!!statementId}
        onOpenChange={(o) => !o && setStatementId(null)}
      />
    </div>
  );
}

// ─── Customer Form Dialog ────────────────────────────────────────────────
interface CustomerFormValues {
  id?: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  company: string;
  notes: string;
}

const emptyForm: CustomerFormValues = {
  name: "", phone: "", whatsapp: "", email: "", address: "", company: "", notes: "",
};

function CustomerFormDialog({
  open, onOpenChange, customer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customer: Customer | null;
}) {
  // Keyed remount strategy: the inner form holds its own state initialized
  // from `customer`. When `customer` (or open state) changes, React remounts
  // the inner form, resetting state cleanly without setState-in-effect.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <CustomerFormInner
          key={open ? (customer?.id ?? "new") : "closed"}
          customer={customer}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomerFormInner({
  customer, onOpenChange,
}: {
  customer: Customer | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CustomerFormValues>(() =>
    customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone ?? "",
          whatsapp: customer.whatsapp ?? "",
          email: customer.email ?? "",
          address: customer.address ?? "",
          company: customer.company ?? "",
          notes: customer.notes ?? "",
        }
      : emptyForm
  );

  const save = useMutation({
    mutationFn: async () => {
      if (form.id) return api.put(`/customers/${form.id}`, form);
      return api.post("/customers", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(form.id ? "Customer updated" : "Customer created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof CustomerFormValues, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle>{form.id ? "Edit Customer" : "New Customer"}</DialogTitle>
      </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Customer Name *">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. John Doe" />
              </Field>
              <Field label="Company">
                <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Shop / business name" />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" />
              </Field>
              <Field label="WhatsApp">
                <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+92 300 1234567" />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="customer@email.com" />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, City, Country" />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Preferences, payment habits, special instructions…" />
              </Field>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {form.id ? "Save Changes" : "Create Customer"}
          </Button>
        </DialogFooter>
    </>
  );
}

// ─── Customer Detail Sheet ───────────────────────────────────────────────
function CustomerDetailSheet({
  customerId, onOpenChange, onEdit, onViewStatement,
}: {
  customerId: string | null;
  onOpenChange: (o: boolean) => void;
  onEdit: (c: Customer) => void;
  onViewStatement: (c: Customer) => void;
}) {
  const open = !!customerId;
  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () => api.get<CustomerDetail>(`/customers/${customerId!}`),
    enabled: !!customerId,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {customer && (
          <>
            <SheetHeader className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-12 w-12 bg-primary/10 text-primary">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {initials(customer.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="text-base">{customer.name}</SheetTitle>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {customer.company && (
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {customer.company}</span>
                      )}
                      <span className="text-muted-foreground/70">Since {formatDate(customer.createdAt)}</span>
                      {!customer.active && <Badge variant="outline" className="text-rose-600">Inactive</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onViewStatement(customer)}
                  >
                    <FileText className="h-3.5 w-3.5" /> Statement
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEdit(customer)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-90px)]">
              <div className="px-6 py-5">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border p-3">
                    <p className="text-[11px] text-muted-foreground">Outstanding</p>
                    <p className={`mt-1 text-lg font-bold ${(customer.outstandingBalance ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
                      {formatCurrency(customer.outstandingBalance ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[11px] text-muted-foreground">Sales</p>
                    <p className="mt-1 text-lg font-bold">{customer._count?.sales ?? customer.sales?.length ?? 0}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-[11px] text-muted-foreground">Repairs</p>
                    <p className="mt-1 text-lg font-bold">{customer._count?.repairJobs ?? customer.repairJobs?.length ?? 0}</p>
                  </div>
                </div>

                {/* Contact info */}
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {customer.phone && (
                    <a href={telLink(customer.phone)} className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Phone className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Phone</p>
                        <p className="truncate text-sm font-medium">{customer.phone}</p>
                      </div>
                    </a>
                  )}
                  {customer.whatsapp && (
                    <a href={whatsappLink(customer.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><MessageCircle className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">WhatsApp</p>
                        <p className="truncate text-sm font-medium">{customer.whatsapp}</p>
                      </div>
                    </a>
                  )}
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-muted/40">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600"><Mail className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Email</p>
                        <p className="truncate text-sm font-medium">{customer.email}</p>
                      </div>
                    </a>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><MapPin className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Address</p>
                        <p className="truncate text-sm font-medium">{customer.address}</p>
                      </div>
                    </div>
                  )}
                  {customer.company && (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600"><Building2 className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground">Company</p>
                        <p className="truncate text-sm font-medium">{customer.company}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {customer.notes && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="mb-1 text-xs font-semibold text-amber-600">Notes</p>
                    <p className="text-sm">{customer.notes}</p>
                  </div>
                )}

                {/* Tabs */}
                <Tabs defaultValue="sales" className="mt-5">
                  <TabsList className="mb-4">
                    <TabsTrigger value="sales">Purchase History</TabsTrigger>
                    <TabsTrigger value="repairs">Repair History</TabsTrigger>
                    <TabsTrigger value="activity">
                      <Clock className="mr-1.5 h-3.5 w-3.5" /> Activity
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="sales">
                    {!customer.sales?.length ? (
                      <EmptyState icon={Receipt} title="No purchases yet" description="Sales invoices for this customer will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {customer.sales.map((s) => (
                          <div key={s.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold">{s.invoiceNo}</p>
                                  <PaymentStatusBadge status={s.paymentStatus} />
                                  <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{s.paymentMethod}</Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{formatDateTime(s.createdAt)} · {s.items?.length ?? 0} items</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{formatCurrency(s.total)}</p>
                                <p className="text-[11px] text-muted-foreground">paid {formatCurrency(s.paid)}</p>
                              </div>
                            </div>
                            {s.items?.length > 0 && (
                              <div className="mt-2 space-y-1 border-t pt-2">
                                {s.items.map((it) => (
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

                  <TabsContent value="repairs">
                    {!customer.repairJobs?.length ? (
                      <EmptyState icon={Wrench} title="No repair jobs yet" description="Repair tickets for this customer will appear here." />
                    ) : (
                      <div className="space-y-2">
                        {customer.repairJobs.map((r) => (
                          <div key={r.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold">{r.ticketNo}</p>
                                  <RepairStatusBadge status={r.status} />
                                  <PaymentStatusBadge status={r.paymentStatus} />
                                </div>
                                <p className="mt-0.5 truncate text-xs font-medium">{r.problem}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatDate(r.createdAt)}
                                  {r.model?.name ? ` · ${r.model.brand?.name ?? ""} ${r.model.name}` : ""}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{formatCurrency(r.total)}</p>
                                <p className="text-[11px] text-muted-foreground">paid {formatCurrency(r.paid)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="activity">
                    <div className="rounded-xl border bg-card p-4 shadow-soft">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">Recent Activity</p>
                          <p className="text-[11px] text-muted-foreground">
                            Latest sales, repairs &amp; payments — running balance shown next to each entry.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => onViewStatement(customer)}
                        >
                          <FileText className="h-3.5 w-3.5" /> Full Statement
                        </Button>
                      </div>
                      <ActivityTimeline
                        partyType="customer"
                        partyId={customer.id}
                        limit={10}
                        emptyTitle="No activity yet"
                        emptyDescription="Sales, repair jobs, and payments for this customer will appear here in chronological order."
                      />
                    </div>
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
