"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { RepairStatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, formatDateTime, timeAgo, initials } from "@/lib/format";
import { REPAIR_STATUSES, type RepairStatus } from "@/lib/types";
import {
  Wrench,
  Plus,
  Search,
  Phone,
  User2,
  Smartphone,
  Clock,
  Loader2,
  Trash2,
  Package,
  CircleDot,
  Stethoscope,
  PackageOpen,
  Cog,
  CheckCircle2,
  Truck,
  X,
  Save,
  AlertCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
}

interface PhoneModel {
  id: string;
  name: string;
  brand?: { name: string } | null;
}

interface Technician {
  id: string;
  name: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
}

interface ProductLite {
  id: string;
  name: string;
  sku: string;
  stock: number;
  purchasePrice: number;
  brand?: { name: string } | null;
  model?: { name: string } | null;
}

interface RepairPart {
  id: string;
  productId: string;
  qty: number;
  cost: number;
  used: boolean;
  product: ProductLite;
}

interface Repair {
  id: string;
  ticketNo: string;
  customerId?: string | null;
  customer?: Customer | null;
  modelId?: string | null;
  model?: PhoneModel | null;
  technicianId?: string | null;
  technician?: Technician | null;
  imei?: string | null;
  problem: string;
  diagnosis?: string | null;
  status: RepairStatus;
  paymentStatus: string;
  laborCost: number;
  partsCost: number;
  total: number;
  paid: number;
  notes?: string | null;
  receivedAt: string;
  completedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  parts?: RepairPart[];
}

// ── Kanban columns (6 + CANCELLED filter) ──────────────────────────────
const COLUMNS: {
  status: RepairStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  bar: string;
  ring: string;
}[] = [
  {
    status: "RECEIVED",
    label: "Received",
    icon: CircleDot,
    accent: "text-zinc-600 dark:text-zinc-300",
    bar: "bg-zinc-400",
    ring: "ring-zinc-500/20 bg-zinc-500/5",
  },
  {
    status: "DIAGNOSED",
    label: "Diagnosed",
    icon: Stethoscope,
    accent: "text-teal-600 dark:text-teal-400",
    bar: "bg-teal-500",
    ring: "ring-teal-500/20 bg-teal-500/5",
  },
  {
    status: "WAITING_PARTS",
    label: "Waiting Parts",
    icon: PackageOpen,
    accent: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    ring: "ring-amber-500/20 bg-amber-500/5",
  },
  {
    status: "REPAIRING",
    label: "Repairing",
    icon: Cog,
    accent: "text-purple-600 dark:text-purple-400",
    bar: "bg-purple-500",
    ring: "ring-purple-500/20 bg-purple-500/5",
  },
  {
    status: "COMPLETED",
    label: "Ready",
    icon: CheckCircle2,
    accent: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    ring: "ring-emerald-500/20 bg-emerald-500/5",
  },
  {
    status: "DELIVERED",
    label: "Delivered",
    icon: Truck,
    accent: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-700",
    ring: "ring-emerald-700/20 bg-emerald-700/5",
  },
];

const STATUS_OPTIONS: { value: RepairStatus; label: string }[] = [
  { value: "RECEIVED", label: "Received" },
  { value: "DIAGNOSED", label: "Diagnosed" },
  { value: "WAITING_PARTS", label: "Waiting Parts" },
  { value: "REPAIRING", label: "Repairing" },
  { value: "COMPLETED", label: "Ready" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ── Helpers ────────────────────────────────────────────────────────────
function getInitials(name?: string | null): string {
  if (!name) return "?";
  return initials(name);
}

// ── Main view ──────────────────────────────────────────────────────────
export function RepairsView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch all repairs in one shot for the kanban.
  const { data, isLoading, isError, error, refetch } = useQuery<{ data: Repair[]; total: number }>({
    queryKey: ["repairs", "kanban"],
    queryFn: () => api.get("/repairs?pageSize=200"),
    staleTime: 15_000,
  });

  const repairs = data?.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return repairs;
    const q = search.toLowerCase();
    return repairs.filter((r) => {
      return (
        r.ticketNo.toLowerCase().includes(q) ||
        r.problem.toLowerCase().includes(q) ||
        r.customer?.name?.toLowerCase().includes(q) ||
        r.customer?.phone?.toLowerCase().includes(q) ||
        r.model?.name?.toLowerCase().includes(q) ||
        r.model?.brand?.name?.toLowerCase().includes(q) ||
        r.technician?.name?.toLowerCase().includes(q) ||
        r.imei?.toLowerCase().includes(q)
      );
    });
  }, [repairs, search]);

  // Group by status — only the 6 kanban statuses are shown. CANCELLED hidden.
  const grouped = useMemo(() => {
    const map: Record<RepairStatus, Repair[]> = {
      RECEIVED: [],
      DIAGNOSED: [],
      WAITING_PARTS: [],
      REPAIRING: [],
      COMPLETED: [],
      DELIVERED: [],
      CANCELLED: [],
    };
    for (const r of filtered) {
      if (map[r.status]) map[r.status].push(r);
    }
    return map;
  }, [filtered]);

  const selectedRepair = useMemo(
    () => repairs.find((r) => r.id === selectedId) ?? null,
    [repairs, selectedId]
  );

  const totalActive = filtered.filter((r) => r.status !== "CANCELLED" && r.status !== "DELIVERED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Repairs"
        description="Simple kanban — track every ticket from received to delivered"
        icon={Wrench}
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ticket, customer, phone…"
                className="h-9 w-full pl-9 sm:w-64"
              />
            </div>
            <Button onClick={() => setNewOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> New Ticket
            </Button>
          </>
        }
      />

      {/* Quick stats strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="gap-1">
          <Wrench className="h-3 w-3" /> {repairs.length} total
        </Badge>
        <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400">
          <Clock className="h-3 w-3" /> {totalActive} active
        </Badge>
        {isError && (
          <Badge variant="outline" className="gap-1 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-3 w-3" /> Failed to load
          </Badge>
        )}
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <Card className="p-4 shadow-card">
          <LoadingState />
        </Card>
      ) : isError ? (
        <Card className="p-4 shadow-card">
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load repairs"
            description={error?.message ?? "Please try again."}
            action={
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        </Card>
      ) : repairs.length === 0 ? (
        <Card className="p-4 shadow-card">
          <EmptyState
            icon={Wrench}
            title="No repair tickets yet"
            description="Create your first ticket to start tracking repairs on the kanban."
            action={
              <Button onClick={() => setNewOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> New Ticket
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max gap-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                column={col}
                repairs={grouped[col.status]}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>
      )}

      {/* New ticket dialog */}
      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} />

      {/* Detail sheet */}
      <RepairDetailSheet
        repair={selectedRepair}
        open={!!selectedId}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
        onMutated={() => qc.invalidateQueries({ queryKey: ["repairs"] })}
      />
    </div>
  );
}

// ── Kanban column ──────────────────────────────────────────────────────
function KanbanColumn({
  column,
  repairs,
  onSelect,
}: {
  column: (typeof COLUMNS)[number];
  repairs: Repair[];
  onSelect: (id: string) => void;
}) {
  const Icon = column.icon;
  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-xl bg-muted/40 ring-1 ring-inset ring-border/60">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${column.ring}`}>
            <Icon className={`h-4 w-4 ${column.accent}`} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{column.label}</p>
            <p className="text-[11px] text-muted-foreground">{repairs.length} ticket{repairs.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold ${column.ring} ${column.accent}`}>
          {repairs.length}
        </span>
      </div>
      <div className={`h-0.5 w-full ${column.bar} opacity-60`} />
      <div className="flex flex-col gap-2 p-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 repairs-scroll">
        {repairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-3 py-8 text-center">
            <Icon className="h-6 w-6 text-muted-foreground/40" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Drop tickets here</p>
          </div>
        ) : (
          repairs.map((r) => (
            <KanbanCard key={r.id} repair={r} onClick={() => onSelect(r.id)} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Kanban card ────────────────────────────────────────────────────────
function KanbanCard({ repair, onClick }: { repair: Repair; onClick: () => void }) {
  const tech = repair.technician;
  const customerName = repair.customer?.name ?? "Walk-in";
  const phoneModel = repair.model
    ? `${repair.model.brand?.name ?? ""} ${repair.model.name}`.trim()
    : "—";

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-lg border border-border/70 bg-card p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
          {repair.ticketNo}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(repair.receivedAt)}
        </span>
      </div>

      <p className="mt-1.5 truncate text-sm font-semibold">{customerName}</p>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Smartphone className="h-3 w-3 shrink-0" />
        <span className="truncate">{phoneModel}</span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/90">
        {repair.problem}
      </p>

      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2">
        <div className="flex items-center gap-1.5">
          {tech ? (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {getInitials(tech.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User2 className="h-3 w-3" />
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">
            {tech?.name ?? "Unassigned"}
          </span>
        </div>
        {repair.total > 0 && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(repair.total)}
          </span>
        )}
      </div>
    </button>
  );
}

// ── New ticket dialog ──────────────────────────────────────────────────
function NewTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [modelId, setModelId] = useState("");
  const [imei, setImei] = useState("");
  const [problem, setProblem] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [laborCost, setLaborCost] = useState("0");

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers", "list"],
    queryFn: () => api.get("/customers"),
    staleTime: 60_000,
  });
  const { data: models = [] } = useQuery<PhoneModel[]>({
    queryKey: ["models", "list"],
    queryFn: () => api.get("/models"),
    staleTime: 60_000,
  });
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ["users", "list"],
    queryFn: () => api.get("/users"),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (body: unknown) => api.post<Repair>("/repairs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast.success("Ticket created");
      // reset
      setCustomerId("");
      setModelId("");
      setImei("");
      setProblem("");
      setTechnicianId("");
      setLaborCost("0");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!problem.trim()) {
      toast.error("Problem description is required");
      return;
    }
    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }
    createMut.mutate({
      customerId: customerId || undefined,
      modelId: modelId || undefined,
      imei: imei.trim() || undefined,
      problem: problem.trim(),
      technicianId: technicianId || undefined,
      laborCost: Number(laborCost) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> New Repair Ticket
          </DialogTitle>
          <DialogDescription>
            Create a new repair ticket. It will be added to the &ldquo;Received&rdquo; column.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label>Customer <span className="text-rose-500">*</span></Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` · ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone model</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.brand?.name ? `${m.brand.name} ` : ""}{m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imei">IMEI (optional)</Label>
              <Input
                id="imei"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="15 digits"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="problem">Problem <span className="text-rose-500">*</span></Label>
            <Textarea
              id="problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe the issue reported by the customer…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.role?.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="labor">Labor cost (Rs)</Label>
              <Input
                id="labor"
                type="number"
                min="0"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={createMut.isPending} className="gap-1.5">
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────
function RepairDetailSheet({
  repair,
  open,
  onOpenChange,
  onMutated,
}: {
  repair: Repair | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMutated: () => void;
}) {
  // The outer component owns the Sheet's open state; the keyed inner body
  // initializes its editable local state from `repair` once per (re)mount,
  // which happens whenever the selected repair id changes — clean state reset
  // without refs or effects.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {repair ? (
          <RepairSheetBody key={repair.id} repair={repair} onMutated={onMutated} onClose={() => onOpenChange(false)} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RepairSheetBody({
  repair,
  onMutated,
  onClose,
}: {
  repair: Repair;
  onMutated: () => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? "");
  const [laborCost, setLaborCost] = useState(String(repair.laborCost ?? 0));
  const [technicianId, setTechnicianId] = useState(repair.technicianId ?? "");
  const [notes, setNotes] = useState(repair.notes ?? "");
  const [paid, setPaid] = useState(String(repair.paid ?? 0));

  // Status change — patch immediately.
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RepairStatus }) =>
      api.patch<Repair>(`/repairs/${id}`, { status }),
    onSuccess: () => {
      onMutated();
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Save editable fields.
  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<Repair>(`/repairs/${repair.id}`, body),
    onSuccess: () => {
      onMutated();
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete ticket.
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/repairs/${id}`),
    onSuccess: () => {
      onMutated();
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast.success("Ticket deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdits = () => {
    saveMut.mutate({
      diagnosis: diagnosis.trim() || null,
      laborCost: Number(laborCost) || 0,
      technicianId: technicianId || null,
      notes: notes.trim() || null,
      paid: Number(paid) || 0,
    });
  };

  const customerName = repair.customer?.name ?? "Walk-in";
  const phoneModel = repair.model
    ? `${repair.model.brand?.name ?? ""} ${repair.model.name}`.trim()
    : "—";
  const balance = Math.max(0, repair.total - repair.paid);

  return (
    <>
      {/* Header */}
      <div className="border-b bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-5">
        <SheetHeader className="p-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                <span className="font-mono">{repair.ticketNo}</span>
              </SheetTitle>
              <SheetDescription className="mt-0.5">
                Received {formatDateTime(repair.receivedAt)}
              </SheetDescription>
            </div>
            <RepairStatusBadge status={repair.status} />
          </div>
        </SheetHeader>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {/* Status quick-change */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Move to status
          </Label>
          <Select
            value={repair.status}
            onValueChange={(v) =>
              statusMut.mutate({ id: repair.id, status: v as RepairStatus })
            }
            disabled={statusMut.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Customer & device */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard icon={User2} label="Customer" value={customerName} sub={repair.customer?.phone ?? repair.customer?.whatsapp ?? undefined} />
          <InfoCard icon={Phone} label="Phone" value={phoneModel} sub={repair.imei ? `IMEI ${repair.imei}` : undefined} />
        </div>

        {/* Problem */}
        <Card className="p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Problem</p>
          <p className="mt-1 text-sm">{repair.problem}</p>
        </Card>

        {/* Diagnosis */}
        <div className="space-y-1.5">
          <Label htmlFor="diag" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Diagnosis
          </Label>
          <Textarea
            id="diag"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Add diagnosis notes…"
            rows={2}
          />
        </div>

        {/* Technician + labor + paid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Technician</Label>
            <TechSelect value={technicianId} onChange={setTechnicianId} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="labor2" className="text-xs">Labor (Rs)</Label>
            <Input id="labor2" type="number" min="0" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paid2" className="text-xs">Paid (Rs)</Label>
            <Input id="paid2" type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Internal notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional internal notes…"
            rows={2}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={saveEdits} disabled={saveMut.isPending} size="sm" className="gap-1.5">
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save details
          </Button>
        </div>

        <Separator />

        {/* Parts management */}
        <PartsSection repair={repair} onMutated={onMutated} />

        <Separator />

        {/* Cost summary */}
        <Card className="p-4 shadow-soft">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <CostRow label="Labor" value={formatCurrency(repair.laborCost)} />
            <CostRow label="Parts" value={formatCurrency(repair.partsCost)} />
            <CostRow label="Paid" value={formatCurrency(repair.paid)} muted />
            <CostRow label="Total" value={formatCurrency(repair.total)} bold />
          </div>
          {balance > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2 text-sm">
              <span className="font-medium text-amber-700 dark:text-amber-300">Balance due</span>
              <span className="font-bold text-amber-700 dark:text-amber-300">{formatCurrency(balance)}</span>
            </div>
          )}
        </Card>

        {/* Timeline */}
        <Card className="p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
          <Timeline repair={repair} />
        </Card>

        {/* Delete */}
        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
            disabled={deleteMut.isPending}
            onClick={() => {
              if (confirm(`Delete ticket ${repair.ticketNo}? This cannot be undone.`)) {
                deleteMut.mutate(repair.id);
              }
            }}
          >
            {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete ticket
          </Button>
        </div>
      </div>
    </>
  );
}

function TechSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ["users", "list"],
    queryFn: () => api.get("/users"),
    staleTime: 60_000,
  });
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Unassigned</SelectItem>
        {technicians.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function CostRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${muted ? "text-muted-foreground" : "text-foreground/80"}`}>{label}</span>
      <span className={`tabular-nums ${bold ? "text-base font-bold" : "text-sm font-semibold"}`}>{value}</span>
    </div>
  );
}

function Timeline({ repair }: { repair: Repair }) {
  const steps: { label: string; at?: string | null; done: boolean }[] = [
    { label: "Received", at: repair.receivedAt, done: true },
    { label: "Diagnosed", at: repair.status === "DIAGNOSED" || repair.completedAt || repair.deliveredAt ? repair.createdAt : null, done: ["DIAGNOSED", "WAITING_PARTS", "REPAIRING", "COMPLETED", "DELIVERED"].includes(repair.status) },
    { label: "Completed", at: repair.completedAt, done: !!repair.completedAt || repair.status === "DELIVERED" },
    { label: "Delivered", at: repair.deliveredAt, done: !!repair.deliveredAt },
  ];
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-2.5">
          <div className={`flex h-5 w-5 items-center justify-center rounded-full ${s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            {s.done ? <CheckCircle2 className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
          </div>
          <div className="flex-1">
            <p className={`text-sm ${s.done ? "font-medium" : "text-muted-foreground"}`}>{s.label}</p>
          </div>
          {s.at && <span className="text-xs text-muted-foreground">{formatDateTime(s.at)}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Parts section ──────────────────────────────────────────────────────
function PartsSection({ repair, onMutated }: { repair: Repair; onMutated: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [useNow, setUseNow] = useState(false);
  const [query, setQuery] = useState("");

  const { data: productsResp } = useQuery<{ data: ProductLite[]; total: number }>({
    queryKey: ["products", "pick", query],
    queryFn: () => api.get(`/products?pageSize=50&q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
  const products = productsResp?.data ?? [];

  const addMut = useMutation({
    mutationFn: (body: { productId: string; qty: number; used: boolean }) =>
      api.post(`/repairs/${repair.id}/parts`, body),
    onSuccess: () => {
      onMutated();
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast.success("Part added");
      setProductId("");
      setQty("1");
      setUseNow(false);
      setQuery("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ partId, used }: { partId: string; used: boolean }) =>
      api.patch(`/repairs/${repair.id}/parts?partId=${partId}`, { used }),
    onSuccess: () => {
      onMutated();
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast.success("Part updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (partId: string) => api.del(`/repairs/${repair.id}/parts?partId=${partId}`),
    onSuccess: () => {
      onMutated();
      qc.invalidateQueries({ queryKey: ["repairs"] });
      toast.success("Part removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const parts = repair.parts ?? [];

  const addPart = () => {
    if (!productId) {
      toast.error("Pick a part first");
      return;
    }
    const q = Math.max(1, parseInt(qty, 10) || 1);
    addMut.mutate({ productId, qty: q, used: useNow });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Parts used ({parts.length})
        </p>
      </div>

      {/* Existing parts */}
      {parts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
          No parts added yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {parts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.product.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {p.product.sku} · qty {p.qty} · {formatCurrency(p.cost)}
                </p>
              </div>
              <button
                onClick={() => toggleMut.mutate({ partId: p.id, used: !p.used })}
                disabled={toggleMut.isPending}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                  p.used
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
                title={p.used ? "Used — click to restock" : "Click to mark as used (deduct stock)"}
              >
                {p.used ? "USED" : "RESERVED"}
              </button>
              <button
                onClick={() => delMut.mutate(p.id)}
                disabled={delMut.isPending}
                className="rounded-md p-1 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600"
                title="Remove part"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add part form */}
      <div className="rounded-lg border border-border/70 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Add a part</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setProductId("");
            }}
            placeholder="Search parts by name, SKU…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        {products.length > 0 && (
          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-border/60">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setProductId(p.id);
                  setQuery(`${p.name} (${p.sku})`);
                }}
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/60 ${
                  productId === p.id ? "bg-primary/10" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-1 text-muted-foreground">{p.sku}</span>
                </span>
                <span className={`shrink-0 ${p.stock <= 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                  {p.stock} in stock
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-8 w-16 text-xs"
          />
          <label className="flex flex-1 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={useNow}
              onChange={(e) => setUseNow(e.target.checked)}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
            Use now (deduct stock)
          </label>
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={addPart} disabled={addMut.isPending || !productId}>
            {addMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
