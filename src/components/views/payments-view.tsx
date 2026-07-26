"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet, Plus, Trash2, Loader2, Search, ArrowDownLeft, ArrowUpRight,
  Receipt, FileText, User, Building2, Calendar, AlertCircle, Sparkles,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/types";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────

interface Party {
  id: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  outstandingBalance: number;
  balance: number;
}

interface LinkedDoc {
  id: string;
  invoiceNo?: string;
  poNo?: string;
  total: number;
  paid: number;
  createdAt: string;
}

interface Payment {
  id: string;
  partyType: "CUSTOMER" | "SUPPLIER";
  partyId: string;
  saleId: string | null;
  purchaseId: string | null;
  amount: number;
  method: string;
  note: string | null;
  date: string;
  partyName: string;
  partySub: string | null;
  invoiceNo: string | null;
  poNo: string | null;
}

interface PaymentsResponse {
  data: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

type PartyType = "CUSTOMER" | "SUPPLIER";

// ─── Helpers ─────────────────────────────────────────────────────────────

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

// ─── Main View ───────────────────────────────────────────────────────────
export function PaymentsView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<PartyType>("CUSTOMER");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [method, setMethod] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);

  // Build query string for the payments list endpoint.
  const listQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set("partyType", tab);
    p.set("pageSize", "100");
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (method !== "ALL") p.set("method", method);
    if (q) p.set("q", q);
    return p.toString();
  }, [tab, from, to, method, q]);

  const { data: paymentsResp, isLoading, isError, error, refetch } = useQuery<PaymentsResponse>({
    queryKey: ["payments", listQuery],
    queryFn: () => api.get<PaymentsResponse>(`/payments?${listQuery}`),
  });
  const payments = paymentsResp?.data ?? [];

  // Fetch customers + suppliers for stats + party selection.
  const { data: customers = [] } = useQuery<Party[]>({
    queryKey: ["customers"],
    queryFn: () => api.get<Party[]>(`/customers`),
  });
  const { data: suppliers = [] } = useQuery<Party[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Party[]>(`/suppliers`),
  });

  // Stats
  const totalReceivedThisMonth = useMemo(
    () =>
      payments
        .filter((p) => p.partyType === "CUSTOMER" && isThisMonth(p.date))
        .reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const totalPaidThisMonth = useMemo(
    () =>
      payments
        .filter((p) => p.partyType === "SUPPLIER" && isThisMonth(p.date))
        .reduce((s, p) => s + p.amount, 0),
    [payments]
  );
  const totalReceivable = useMemo(
    () => customers.reduce((s, c) => s + (c.outstandingBalance ?? 0), 0),
    [customers]
  );
  const totalPayable = useMemo(
    () => suppliers.reduce((s, sup) => s + (sup.outstandingBalance ?? 0), 0),
    [suppliers]
  );

  // Reset filters helper.
  const resetFilters = useCallback(() => {
    setFrom("");
    setTo("");
    setMethod("ALL");
    setQ("");
  }, []);

  const openRecord = () => setRecordOpen(true);

  // Delete handler.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Payment reversed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = (p: Payment) => {
    if (!confirm(`Reverse this ${formatCurrency(p.amount)} payment from ${p.partyName}? This will restore the outstanding balance.`)) return;
    deleteMutation.mutate(p.id);
  };

  const columns: Column<Payment>[] = [
    {
      key: "date",
      header: "Date",
      className: "min-w-[150px]",
      render: (p) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{formatDateTime(p.date)}</span>
        </div>
      ),
    },
    {
      key: "party",
      header: tab === "CUSTOMER" ? "Customer" : "Supplier",
      className: "min-w-[200px]",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${p.partyType === "CUSTOMER" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-teal-500/10 text-teal-600 dark:text-teal-400"}`}>
            {p.partyType === "CUSTOMER" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.partyName}</p>
            <p className="truncate text-xs text-muted-foreground">{p.partySub ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "min-w-[110px]",
      render: (p) =>
        p.partyType === "CUSTOMER" ? (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
            <ArrowDownLeft className="mr-1 h-3 w-3" /> Received
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
            <ArrowUpRight className="mr-1 h-3 w-3" /> Paid
          </Badge>
        ),
    },
    {
      key: "doc",
      header: "Linked Invoice / PO",
      className: "min-w-[140px]",
      render: (p) => {
        if (p.invoiceNo) {
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{p.invoiceNo}</span>
            </div>
          );
        }
        if (p.poNo) {
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{p.poNo}</span>
            </div>
          );
        }
        return <span className="text-xs text-muted-foreground">On account</span>;
      },
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right min-w-[120px]",
      render: (p) => (
        <div className="text-right">
          <p className={`text-sm font-semibold ${p.partyType === "CUSTOMER" ? "text-emerald-600 dark:text-emerald-400" : "text-teal-600 dark:text-teal-400"}`}>
            {formatCurrency(p.amount)}
          </p>
        </div>
      ),
    },
    {
      key: "method",
      header: "Method",
      className: "min-w-[100px]",
      render: (p) => <Badge variant="secondary" className="font-medium text-xs">{p.method}</Badge>,
    },
    {
      key: "note",
      header: "Note",
      className: "min-w-[160px] max-w-[260px]",
      render: (p) =>
        p.note ? (
          <p className="truncate text-xs text-muted-foreground" title={p.note}>{p.note}</p>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(p);
            }}
            title="Reverse payment"
            aria-label="Reverse payment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description="Record customer payments and supplier payments, track outstanding balances"
        icon={Wallet}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openRecord}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Received This Month"
          value={formatCurrency(totalReceivedThisMonth)}
          icon={ArrowDownLeft}
          accent="emerald"
          subtitle="From customers"
        />
        <StatCard
          label="Paid This Month"
          value={formatCurrency(totalPaidThisMonth)}
          icon={ArrowUpRight}
          accent="teal"
          subtitle="To suppliers"
        />
        <StatCard
          label="Outstanding Receivable"
          value={formatCurrency(totalReceivable)}
          icon={Receipt}
          accent={totalReceivable > 0 ? "amber" : "emerald"}
          subtitle="Across all customers"
        />
        <StatCard
          label="Outstanding Payable"
          value={formatCurrency(totalPayable)}
          icon={FileText}
          accent={totalPayable > 0 ? "amber" : "emerald"}
          subtitle="Across all suppliers"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PartyType)}>
        <TabsList>
          <TabsTrigger value="CUSTOMER" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Customer Payments
          </TabsTrigger>
          <TabsTrigger value="SUPPLIER" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Supplier Payments
          </TabsTrigger>
        </TabsList>

        {(["CUSTOMER", "SUPPLIER"] as PartyType[]).map((pt) => (
          <TabsContent key={pt} value={pt} className="mt-4 space-y-4">
            {/* Filters card */}
            <Card className="p-4 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Search</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={pt === "CUSTOMER" ? "Customer, invoice, note…" : "Supplier, PO, note…"}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
                </div>
                <div className="min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
                </div>
                <div className="min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="All methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All methods</SelectItem>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(from || to || method !== "ALL" || q) && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={resetFilters}>
                    <Sparkles className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>
            </Card>

            {/* Payments table */}
            {isError ? (
              <Card className="p-0">
                <ErrorState message={error?.message ?? "Failed to load payments"} onRetry={() => refetch()} />
              </Card>
            ) : payments.length === 0 && !isLoading ? (
              <Card className="p-0">
                <EmptyState
                  icon={Wallet}
                  title={pt === "CUSTOMER" ? "No customer payments yet" : "No supplier payments yet"}
                  description={
                    from || to || method !== "ALL" || q
                      ? "No payments match your filters. Try clearing them."
                      : pt === "CUSTOMER"
                      ? "Record your first customer payment to start tracking receivables."
                      : "Record your first supplier payment to start tracking payables."
                  }
                  action={
                    <Button size="sm" className="gap-1.5" onClick={openRecord}>
                      <Plus className="h-4 w-4" /> Record Payment
                    </Button>
                  }
                />
              </Card>
            ) : (
              <DataTable
                columns={columns}
                data={payments}
                loading={isLoading}
                rowKey={(p) => p.id}
                pagination
                page={1}
                pageSize={payments.length || 1}
                total={payments.length}
                emptyTitle="No payments found"
                emptyDescription="Try adjusting your filters or record a new payment."
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <RecordPaymentDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        defaultPartyType={tab}
      />
    </div>
  );
}

// ─── Record Payment Dialog ───────────────────────────────────────────────

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultPartyType: PartyType;
}

function RecordPaymentDialog({ open, onOpenChange, defaultPartyType }: RecordPaymentDialogProps) {
  const qc = useQueryClient();
  const [partyType, setPartyType] = useState<PartyType>(defaultPartyType);
  const [partyId, setPartyId] = useState<string>("");
  const [linkedDocId, setLinkedDocId] = useState<string>("NONE");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("CASH");
  const [note, setNote] = useState<string>("");
  const [partySearch, setPartySearch] = useState<string>("");

  // Sync partyType + reset form state using the React 19 "adjust state when
  // props change" pattern (no effects, no cascading renders).
  const [lastSeenOpen, setLastSeenOpen] = useState(open);
  const [lastSeenDefaultPartyType, setLastSeenDefaultPartyType] = useState<PartyType>(defaultPartyType);
  const [lastSeenPartyType, setLastSeenPartyType] = useState<PartyType>(partyType);

  // On open: sync partyType from defaultPartyType. On close: reset form state.
  if (open !== lastSeenOpen) {
    setLastSeenOpen(open);
    if (open) {
      setPartyType(defaultPartyType);
      setLastSeenDefaultPartyType(defaultPartyType);
    } else {
      setPartyId("");
      setLinkedDocId("NONE");
      setAmount("");
      setMethod("CASH");
      setNote("");
      setPartySearch("");
    }
  }

  // If the parent's defaultPartyType changes while open (user switched tab), follow it.
  if (open && defaultPartyType !== lastSeenDefaultPartyType) {
    setLastSeenDefaultPartyType(defaultPartyType);
    setPartyType(defaultPartyType);
  }

  // When the user manually toggles partyType inside the dialog (or it was just
  // synced from defaultPartyType), reset the dependent selection fields.
  if (partyType !== lastSeenPartyType) {
    setLastSeenPartyType(partyType);
    setPartyId("");
    setLinkedDocId("NONE");
    setAmount("");
  }

  const isCustomer = partyType === "CUSTOMER";

  // Fetch the appropriate party list.
  const { data: customers = [] } = useQuery<Party[]>({
    queryKey: ["customers"],
    queryFn: () => api.get<Party[]>(`/customers`),
    enabled: isCustomer && open,
  });
  const { data: suppliers = [] } = useQuery<Party[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Party[]>(`/suppliers`),
    enabled: !isCustomer && open,
  });
  const parties = isCustomer ? customers : suppliers;

  // Fetch outstanding documents for the selected party.
  const selectedParty = parties.find((p) => p.id === partyId) ?? null;
  const { data: outstandingDocs = [], isLoading: docsLoading } = useQuery<LinkedDoc[]>({
    queryKey: ["payments", "outstanding", partyType, partyId],
    queryFn: async () => {
      if (!partyId) return [];
      if (isCustomer) {
        // Fetch PARTIAL + UNPAID sales for this customer.
        const [partial, unpaid] = await Promise.all([
          api.get<{ data: LinkedDoc[] }>(`/sales?customerId=${partyId}&paymentStatus=PARTIAL&pageSize=100`),
          api.get<{ data: LinkedDoc[] }>(`/sales?customerId=${partyId}&paymentStatus=UNPAID&pageSize=100`),
        ]);
        return [...(partial.data ?? []), ...(unpaid.data ?? [])];
      }
      const [partial, unpaid] = await Promise.all([
        api.get<{ data: LinkedDoc[] }>(`/purchases?supplierId=${partyId}&paymentStatus=PARTIAL&pageSize=100`),
        api.get<{ data: LinkedDoc[] }>(`/purchases?supplierId=${partyId}&paymentStatus=UNPAID&pageSize=100`),
      ]);
      return [...(partial.data ?? []), ...(unpaid.data ?? [])];
    },
    enabled: !!partyId && open,
  });

  // Compute outstanding for the selected linked doc.
  const selectedDoc = outstandingDocs.find((d) => d.id === linkedDocId) ?? null;
  const selectedDocOutstanding = selectedDoc ? Math.max(0, selectedDoc.total - selectedDoc.paid) : 0;
  const partyOutstanding = selectedParty ? Math.max(0, selectedParty.outstandingBalance ?? 0) : 0;
  const displayOutstanding = selectedDoc ? selectedDocOutstanding : partyOutstanding;

  // Filter parties by search query.
  const filteredParties = useMemo(() => {
    if (!partySearch) return parties;
    const needle = partySearch.toLowerCase();
    return parties.filter((p) =>
      p.name.toLowerCase().includes(needle) ||
      (p.phone ?? "").toLowerCase().includes(needle) ||
      (p.company ?? "").toLowerCase().includes(needle)
    );
  }, [parties, partySearch]);

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        partyType,
        partyId,
        amount: Number(amount),
        method,
        note: note.trim() || undefined,
      };
      if (linkedDocId !== "NONE") {
        if (isCustomer) body.saleId = linkedDocId;
        else body.purchaseId = linkedDocId;
      }
      return api.post("/payments", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Payment recorded");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!partyId) {
      toast.error("Please select a customer or supplier");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Record a payment to track outstanding balances. Link to an invoice or PO for precise allocation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Party type tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPartyType("CUSTOMER")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                isCustomer
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <User className="h-4 w-4" /> Customer
            </button>
            <button
              type="button"
              onClick={() => setPartyType("SUPPLIER")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                !isCustomer
                  ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Building2 className="h-4 w-4" /> Supplier
            </button>
          </div>

          {/* Party selector with search */}
          <div className="space-y-1.5">
            <Label>{isCustomer ? "Customer" : "Supplier"}</Label>
            <Select value={partyId} onValueChange={(v) => { setPartyId(v); setLinkedDocId("NONE"); setAmount(""); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Select a ${isCustomer ? "customer" : "supplier"}…`} />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={partySearch}
                      onChange={(e) => setPartySearch(e.target.value)}
                      placeholder="Search…"
                      className="h-8 pl-8 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <ScrollArea className="max-h-60">
                  {filteredParties.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No {isCustomer ? "customers" : "suppliers"} found
                    </div>
                  ) : (
                    filteredParties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{p.name}</span>
                          {(p.outstandingBalance ?? 0) > 0 && (
                            <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                              {formatCurrency(p.outstandingBalance)}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>

          {/* Selected party outstanding summary */}
          {selectedParty && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Current outstanding</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(partyOutstanding)}</span>
              </div>
            </div>
          )}

          {/* Linked invoice / PO */}
          {selectedParty && (
            <div className="space-y-1.5">
              <Label>{isCustomer ? "Linked invoice (optional)" : "Linked PO (optional)"}</Label>
              {docsLoading ? (
                <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading outstanding {isCustomer ? "invoices" : "POs"}…
                </div>
              ) : (
                <Select value={linkedDocId} onValueChange={(v) => { setLinkedDocId(v); setAmount(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`On account (no specific ${isCustomer ? "invoice" : "PO"})`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">
                      <span className="text-muted-foreground">On account (no specific {isCustomer ? "invoice" : "PO"})</span>
                    </SelectItem>
                    {outstandingDocs.map((d) => {
                      const outstanding = Math.max(0, d.total - d.paid);
                      const ref = isCustomer ? (d as { invoiceNo?: string }).invoiceNo : (d as { poNo?: string }).poNo;
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="truncate">{ref ?? "—"}</span>
                            <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                              {formatCurrency(outstanding)}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              {selectedDoc && (
                <p className="text-xs text-muted-foreground">
                  Invoice total: <span className="font-medium text-foreground">{formatCurrency(selectedDoc.total)}</span>
                  {" · "}Paid: <span className="font-medium text-foreground">{formatCurrency(selectedDoc.paid)}</span>
                  {" · "}Outstanding: <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(selectedDocOutstanding)}</span>
                </p>
              )}
            </div>
          )}

          {/* Amount + pay full */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Amount</Label>
              {displayOutstanding > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.round(displayOutstanding)))}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  <Sparkles className="h-3 w-3" /> Pay full {formatCurrency(displayOutstanding)}
                </button>
              )}
            </div>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-base font-semibold"
            />
          </div>

          {/* Method */}
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reference number, bank transfer details, etc."
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Summary warning */}
          {selectedDoc && Number(amount) > selectedDocOutstanding && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Amount exceeds outstanding balance for this {isCustomer ? "invoice" : "PO"}. The excess will be applied as overpayment.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || !partyId || !amount} className="gap-1.5">
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</>
            ) : (
              <><Wallet className="h-4 w-4" /> Record Payment</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
