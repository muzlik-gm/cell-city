"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState, LoadingState } from "@/components/shared/states";
import { RepairStatusBadge, PaymentStatusBadge } from "@/components/shared/badges";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Wrench, Plus, Search, Eye, Loader2, Trash2, Package, User2, Smartphone,
  Clock, CheckCircle2, Wallet, TrendingUp, ClipboardList, Cog, TimerReset,
  CheckCheck, Truck, AlertTriangle, Image as ImageIcon, X, ChevronRight,
  Wrench as WrenchIcon, Save, Ban, Boxes, PackageX,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, timeAgo, initials } from "@/lib/format";
import { REPAIR_STATUSES, DAMAGE_REASONS, type RepairStatus } from "@/lib/types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart, Pie, Cell as RechartsCell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface User {
  id: string; name: string; email: string; role: string;
  phone?: string | null; avatarUrl?: string | null;
}
interface Customer { id: string; name: string; phone?: string | null; }
interface PhoneModel { id: string; name: string; brand?: { name: string } | null; }
interface Product {
  id: string; sku: string; name: string; stock: number;
  purchasePrice: number; sellingPrice: number;
  brand?: { name: string } | null; model?: { name: string } | null;
}
interface RepairPart {
  id: string; repairId: string; productId: string; qty: number; cost: number; used: boolean;
  product?: Product | null;
}
interface RepairJob {
  id: string; ticketNo: string; customerId?: string | null;
  customer?: Customer | null;
  modelId?: string | null;
  model?: PhoneModel | null;
  technicianId?: string | null;
  technician?: User | null;
  imei?: string | null;
  problem: string; diagnosis?: string | null;
  status: string; paymentStatus: string;
  laborCost: number; partsCost: number; total: number; paid: number;
  notes?: string | null; imageUrl?: string | null;
  receivedAt: string; completedAt?: string | null; deliveredAt?: string | null;
  createdAt: string; updatedAt: string;
  parts?: RepairPart[];
}
interface DamagedItem {
  id: string; productId: string; qty: number; reason: string;
  note?: string | null; imageUrl?: string | null; date: string;
  product?: Product | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — column metadata (no indigo/blue per design system)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_FLOW: RepairStatus[] = [
  "RECEIVED", "DIAGNOSED", "WAITING_PARTS", "REPAIRING", "COMPLETED", "DELIVERED",
];

interface ColumnMeta {
  key: RepairStatus;
  label: string;
  dot: string;      // tailwind bg for dot
  chip: string;     // tailwind classes for count chip
  accent: string;   // tailwind text color for label
  ring: string;     // tailwind border classes for card ring
  icon: React.ComponentType<{ className?: string }>;
}

const COLUMN_META: Record<RepairStatus, ColumnMeta> = {
  RECEIVED:      { key: "RECEIVED",      label: "Received",      dot: "bg-sky-500",     chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",        accent: "text-sky-600 dark:text-sky-400",        ring: "hover:ring-sky-500/30",     icon: ClipboardList },
  DIAGNOSED:     { key: "DIAGNOSED",     label: "Diagnosed",     dot: "bg-teal-500",    chip: "bg-teal-500/10 text-teal-600 dark:text-teal-400",    accent: "text-teal-600 dark:text-teal-400",      ring: "hover:ring-teal-500/30",    icon: Search },
  WAITING_PARTS: { key: "WAITING_PARTS", label: "Waiting Parts", dot: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400", accent: "text-amber-600 dark:text-amber-400",    ring: "hover:ring-amber-500/30",   icon: TimerReset },
  REPAIRING:     { key: "REPAIRING",     label: "Repairing",     dot: "bg-purple-500",  chip: "bg-purple-500/10 text-purple-600 dark:text-purple-400", accent: "text-purple-600 dark:text-purple-400", ring: "hover:ring-purple-500/30",  icon: Cog },
  COMPLETED:     { key: "COMPLETED",     label: "Completed",     dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", accent: "text-emerald-600 dark:text-emerald-400", ring: "hover:ring-emerald-500/30", icon: CheckCircle2 },
  DELIVERED:     { key: "DELIVERED",     label: "Delivered",     dot: "bg-teal-700",    chip: "bg-teal-700/10 text-teal-700 dark:text-teal-300",    accent: "text-teal-700 dark:text-teal-300",      ring: "hover:ring-teal-700/30",    icon: Truck },
};

const DAMAGE_COLORS: Record<string, string> = {
  BROKEN:    "oklch(0.65 0.22 25)",
  DEAD:      "oklch(0.55 0.2 0)",
  WARRANTY:  "oklch(0.6 0.15 250)",
  RETURNED:  "oklch(0.65 0.18 60)",
  REJECTED:  "oklch(0.62 0.2 295)",
  LOST:      "oklch(0.55 0.13 162)",
  DISPOSED:  "oklch(0.5 0.02 250)",
};

// Use a teal in place of WARRANTY/DEAD to stay within palette where possible.
const DAMAGE_CHART_COLORS = [
  "oklch(0.65 0.22 25)",    // BROKEN — rose/red
  "oklch(0.55 0.13 162)",   // DEAD — emerald
  "oklch(0.6 0.18 60)",     // WARRANTY — amber
  "oklch(0.62 0.2 295)",    // RETURNED — purple
  "oklch(0.65 0.18 200)",   // REJECTED — teal
  "oklch(0.55 0.2 0)",      // LOST — red
  "oklch(0.5 0.02 250)",    // DISPOSED — slate
];

// ─────────────────────────────────────────────────────────────────────────────
// Small shared components
// ─────────────────────────────────────────────────────────────────────────────
function TechAvatar({ name, size = "sm" }: { name?: string | null; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const text = size === "md" ? "text-xs" : "text-[10px]";
  if (!name) {
    return (
      <div className={`flex ${dim} items-center justify-center rounded-full bg-muted text-muted-foreground`}>
        <User2 className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <Avatar className={`${dim} ring-2 ring-background`}>
      <AvatarFallback className={`bg-primary/10 ${text} font-semibold text-primary`}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// Visual status timeline stepper — RECEIVED → DIAGNOSED → … → DELIVERED
function StatusTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_FLOW.indexOf(status as RepairStatus);
  const isCancelled = status === "CANCELLED";
  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5">
        <Ban className="h-4 w-4 text-rose-500" />
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">This ticket was cancelled</p>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-1">
      {STATUS_FLOW.map((s, i) => {
        const meta = COLUMN_META[s];
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;
        const Icon = meta.icon;
        return (
          <div key={s} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {/* connector before */}
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : isDone || isCurrent ? meta.dot : "bg-border"}`} />
              {/* circle */}
              <div
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isCurrent
                    ? `${meta.dot} border-transparent text-white shadow-md`
                    : isDone
                    ? `${meta.dot} border-transparent text-white`
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {isDone ? <CheckCheck className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                {isCurrent && (
                  <span className={`absolute -inset-1 animate-ping rounded-full ${meta.dot} opacity-30`} />
                )}
              </div>
              {/* connector after */}
              <div className={`h-0.5 flex-1 ${i === STATUS_FLOW.length - 1 ? "opacity-0" : isDone ? meta.dot : "bg-border"}`} />
            </div>
            <p
              className={`mt-1.5 text-center text-[10px] font-medium leading-tight ${
                isCurrent ? meta.accent : isFuture ? "text-muted-foreground/60" : "text-muted-foreground"
              }`}
            >
              {meta.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Ticket Dialog
// ─────────────────────────────────────────────────────────────────────────────
interface NewTicketPayload {
  customerId?: string; modelId?: string; technicianId?: string;
  imei?: string; problem: string; diagnosis?: string;
  laborCost?: number; partsCost?: number; notes?: string; imageUrl?: string;
}

function NewTicketDialog({
  open, onOpenChange, customers, models, technicians,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: Customer[];
  models: PhoneModel[];
  technicians: User[];
}) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [modelId, setModelId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [imei, setImei] = useState("");
  const [problem, setProblem] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setCustomerId(""); setModelId(""); setTechnicianId(""); setImei("");
    setProblem(""); setDiagnosis(""); setLaborCost(""); setNotes(""); setImageUrl(null);
  }, []);

  const handleSubmit = async () => {
    if (!problem.trim()) { toast.error("Problem description is required"); return; }
    setSaving(true);
    try {
      const payload: NewTicketPayload = {
        problem: problem.trim(),
        ...(customerId ? { customerId } : {}),
        ...(modelId ? { modelId } : {}),
        ...(technicianId ? { technicianId } : {}),
        ...(imei.trim() ? { imei: imei.trim() } : {}),
        ...(diagnosis.trim() ? { diagnosis: diagnosis.trim() } : {}),
        ...(laborCost ? { laborCost: Number(laborCost) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };
      const created = await api.post<RepairJob>("/repairs", payload);
      toast.success(`Ticket ${created.ticketNo} created`);
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-stats"] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/30 p-5">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wrench className="h-4 w-4" />
            </div>
            New Repair Ticket
          </DialogTitle>
          <DialogDescription>Create a new repair job. Ticket number is auto-generated.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Phone Model</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.brand?.name ? `${m.brand.name} ` : ""}{m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Technician</Label>
                <Select value={technicianId} onValueChange={setTechnicianId}>
                  <SelectTrigger><SelectValue placeholder="Assign technician" /></SelectTrigger>
                  <SelectContent>
                    {technicians.length === 0 ? (
                      <SelectItem value="__none" disabled>No technicians available</SelectItem>
                    ) : (
                      technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name} · {t.role}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">IMEI / Serial</Label>
                <Input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="15-digit IMEI (optional)" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Problem <span className="text-rose-500">*</span></Label>
              <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} placeholder="e.g. Broken LCD, touch not working..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Diagnosis</Label>
              <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} placeholder="Initial technician diagnosis (optional)" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Labor Cost (Rs)</Label>
                <Input
                  type="number" min="0" step="50" value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)} placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Image</Label>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <div className="group relative h-16 w-16 overflow-hidden rounded-lg border">
                      <img src={imageUrl} alt="damage" className="h-full w-full object-cover" />
                      <button
                        type="button" onClick={() => setImageUrl(null)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/50 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <ImageUpload value={null} onChange={setImageUrl} label="Upload" className="w-16" />
                  )}
                  <p className="text-[11px] text-muted-foreground">Photo of the device or damage</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes (optional)" />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t bg-muted/30 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !problem.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Part dialog (inside detail sheet)
// ─────────────────────────────────────────────────────────────────────────────
function AddPartDialog({
  open, onOpenChange, repairId,
}: { open: boolean; onOpenChange: (v: boolean) => void; repairId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState("1");
  const [used, setUsed] = useState(true);
  const [saving, setSaving] = useState(false);

  const productsQ = useQuery<{ data: Product[] }>({
    queryKey: ["repair-parts-search", search],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(search)}&pageSize=30`),
    enabled: open,
    staleTime: 10_000,
  });
  const products = productsQ.data?.data ?? [];

  const handleSubmit = async () => {
    if (!selectedId) { toast.error("Select a product"); return; }
    const q = Math.max(1, parseInt(qty, 10) || 1);
    setSaving(true);
    try {
      await api.post(`/repairs/${repairId}/parts`, { productId: selectedId, qty: q, used });
      toast.success("Part added to repair");
      qc.invalidateQueries({ queryKey: ["repair-detail", repairId] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      setSearch(""); setSelectedId(""); setQty("1"); setUsed(true);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b bg-muted/30 p-5">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Add Part from Inventory
          </DialogTitle>
          <DialogDescription>Select a part to attach to this repair ticket.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, SKU, model..."
              className="pl-9"
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border">
            {productsQ.isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No products found</div>
            ) : (
              products.map((p) => (
                <button
                  key={p.id} type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left transition last:border-b-0 hover:bg-muted/50 ${
                    selectedId === p.id ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                    {p.brand?.name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.sku} · stock {p.stock}</p>
                  </div>
                  <span className="text-xs font-semibold">{formatCurrency(p.purchasePrice)}</span>
                </button>
              ))
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stock action</Label>
              <Select value={used ? "used" : "reserved"} onValueChange={(v) => setUsed(v === "used")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="used">Deduct now</SelectItem>
                  <SelectItem value="reserved">Reserve only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/30 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedId} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Part
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Repair Detail Sheet
// ─────────────────────────────────────────────────────────────────────────────
function RepairDetailSheet({
  repairId, onClose,
}: { repairId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [editDiagnosis, setEditDiagnosis] = useState(false);
  const [diagnosisDraft, setDiagnosisDraft] = useState("");
  const [editCosts, setEditCosts] = useState(false);
  const [laborDraft, setLaborDraft] = useState("");
  const [editPayment, setEditPayment] = useState(false);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState("UNPAID");
  const [paidDraft, setPaidDraft] = useState("");

  const open = Boolean(repairId);

  const detailQ = useQuery<RepairJob>({
    queryKey: ["repair-detail", repairId],
    queryFn: () => api.get(`/repairs/${repairId}`),
    enabled: open,
  });
  const r = detailQ.data;

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!repairId) throw new Error("No repair selected");
      return api.patch<RepairJob>(`/repairs/${repairId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repair-detail", repairId] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePartUsed = async (part: RepairPart) => {
    try {
      await api.patch(`/repairs/${repairId}/parts?partId=${part.id}`, { used: !part.used });
      toast.success(part.used ? "Stock restocked" : "Marked as used · stock deducted");
      qc.invalidateQueries({ queryKey: ["repair-detail", repairId] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removePart = async (part: RepairPart) => {
    if (!confirm(`Remove ${part.product?.name ?? "part"} from this repair?${part.used ? " Stock will be restocked." : ""}`)) return;
    try {
      await api.del(`/repairs/${repairId}/parts?partId=${part.id}`);
      toast.success("Part removed");
      qc.invalidateQueries({ queryKey: ["repair-detail", repairId] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!r) return;
    if (!confirm(`Delete ticket ${r.ticketNo}? This cannot be undone.`)) return;
    try {
      await api.del(`/repairs/${r.id}`);
      toast.success("Repair ticket deleted");
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-stats"] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveDiagnosis = () => {
    updateMutation.mutate({ diagnosis: diagnosisDraft }, {
      onSuccess: () => { toast.success("Diagnosis updated"); setEditDiagnosis(false); },
    });
  };
  const saveCosts = () => {
    updateMutation.mutate({ laborCost: Number(laborDraft) || 0 }, {
      onSuccess: () => { toast.success("Labor cost updated"); setEditCosts(false); },
    });
  };
  const savePayment = () => {
    updateMutation.mutate(
      { paymentStatus: paymentStatusDraft, paid: Number(paidDraft) || 0 },
      { onSuccess: () => { toast.success("Payment updated"); setEditPayment(false); } }
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="border-b bg-muted/30 p-5">
          {r ? (
            <>
              <div className="flex items-center justify-between pr-6">
                <div className="min-w-0">
                  <SheetTitle className="flex items-center gap-2 font-mono text-base">
                    {r.ticketNo}
                  </SheetTitle>
                  <SheetDescription className="mt-0.5">
                    Opened {timeAgo(r.receivedAt)} · {formatDateTime(r.receivedAt)}
                  </SheetDescription>
                </div>
                <RepairStatusBadge status={r.status} />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
          )}
        </SheetHeader>

        {detailQ.isLoading ? (
          <LoadingState className="flex-1" />
        ) : detailQ.isError ? (
          <div className="flex-1 p-6 text-sm text-rose-600">Failed to load repair.</div>
        ) : !r ? null : (
          <ScrollArea className="flex-1">
            <div className="space-y-5 p-5">
              {/* Status timeline */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status Timeline</p>
                <StatusTimeline status={r.status} />
              </div>

              {/* Quick status changer */}
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
                <span className="text-xs font-medium text-muted-foreground">Move to:</span>
                <Select
                  value={r.status}
                  onValueChange={(v) => updateMutation.mutate({ status: v })}
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...REPAIR_STATUSES].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("_", " ").toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1"
                  onClick={() => {
                    const next = STATUS_FLOW[STATUS_FLOW.indexOf(r.status as RepairStatus) + 1];
                    if (next) updateMutation.mutate({ status: next });
                  }}
                  disabled={r.status === "DELIVERED" || r.status === "CANCELLED" || updateMutation.isPending}
                >
                  Advance <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                {r.status !== "CANCELLED" && (
                  <Button
                    size="sm" variant="ghost" className="h-8 gap-1 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={() => updateMutation.mutate({ status: "CANCELLED" })}
                    disabled={updateMutation.isPending}
                  >
                    <Ban className="h-3.5 w-3.5" /> Cancel ticket
                  </Button>
                )}
              </div>

              {/* Customer + device */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <User2 className="h-3.5 w-3.5" /> Customer
                  </p>
                  <div className="flex items-center gap-2">
                    <TechAvatar name={r.customer?.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.customer?.name ?? "Walk-in Customer"}</p>
                      <p className="text-xs text-muted-foreground">{r.customer?.phone ?? "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Smartphone className="h-3.5 w-3.5" /> Device
                  </p>
                  <p className="text-sm font-medium">
                    {r.model ? `${r.model.brand?.name ?? ""} ${r.model.name}`.trim() : "—"}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">IMEI: {r.imei || "—"}</p>
                </div>
              </div>

              {/* Technician */}
              <div className="rounded-xl border bg-card p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <WrenchIcon className="h-3.5 w-3.5" /> Technician
                </p>
                <div className="flex items-center gap-2">
                  <TechAvatar name={r.technician?.name} size="md" />
                  <p className="text-sm font-medium">{r.technician?.name ?? "Unassigned"}</p>
                  {r.technician && <Badge variant="secondary" className="text-[10px]">{r.technician.role}</Badge>}
                </div>
              </div>

              {/* Problem */}
              <div className="rounded-xl border bg-card p-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Problem Reported</p>
                <p className="text-sm">{r.problem}</p>
              </div>

              {/* Diagnosis — inline editable */}
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</p>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                    onClick={() => { setDiagnosisDraft(r.diagnosis ?? ""); setEditDiagnosis(!editDiagnosis); }}
                  >
                    {editDiagnosis ? "Cancel" : "Edit"}
                  </Button>
                </div>
                {editDiagnosis ? (
                  <div className="space-y-2">
                    <Textarea value={diagnosisDraft} onChange={(e) => setDiagnosisDraft(e.target.value)} rows={3}
                      placeholder="Technical findings, root cause..." />
                    <Button size="sm" className="h-7 gap-1" onClick={saveDiagnosis} disabled={updateMutation.isPending}>
                      <Save className="h-3 w-3" /> Save
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{r.diagnosis || "No diagnosis recorded yet."}</p>
                )}
              </div>

              {/* Parts used */}
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Package className="h-3.5 w-3.5" /> Parts Used
                    <Badge variant="secondary" className="text-[10px]">{r.parts?.length ?? 0}</Badge>
                  </p>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setAddPartOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Part
                  </Button>
                </div>
                {r.parts && r.parts.length > 0 ? (
                  <div className="space-y-1.5">
                    {r.parts.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold">
                          {p.product?.brand?.name?.[0] ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{p.product?.name ?? "Unknown product"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.qty} × {formatCurrency(p.cost / p.qty)} = <span className="font-semibold">{formatCurrency(p.cost)}</span>
                          </p>
                        </div>
                        <button
                          onClick={() => togglePartUsed(p)}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                            p.used
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                          }`}
                          title={p.used ? "Used — click to restock" : "Reserved — click to deduct stock"}
                        >
                          {p.used ? "Used" : "Reserved"}
                        </button>
                        <button
                          onClick={() => removePart(p)}
                          className="rounded-md p-1 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-3 text-center text-xs text-muted-foreground">No parts added yet</p>
                )}
              </div>

              {/* Costs breakdown */}
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Costs Breakdown</p>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                    onClick={() => { setLaborDraft(String(r.laborCost)); setEditCosts(!editCosts); }}
                  >
                    {editCosts ? "Cancel" : "Edit labor"}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Labor</span>
                    {editCosts ? (
                      <Input type="number" min="0" step="50" value={laborDraft} onChange={(e) => setLaborDraft(e.target.value)}
                        className="h-7 w-28 text-right text-xs" />
                    ) : (
                      <span className="font-medium">{formatCurrency(r.laborCost)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Parts</span>
                    <span className="font-medium">{formatCurrency(r.partsCost)}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Total</span>
                    <span className="text-base font-bold text-primary">{formatCurrency(r.total)}</span>
                  </div>
                  {editCosts && (
                    <Button size="sm" className="mt-1 h-7 gap-1" onClick={saveCosts} disabled={updateMutation.isPending}>
                      <Save className="h-3 w-3" /> Save labor
                    </Button>
                  )}
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                    onClick={() => { setPaymentStatusDraft(r.paymentStatus); setPaidDraft(String(r.paid)); setEditPayment(!editPayment); }}
                  >
                    {editPayment ? "Cancel" : "Edit"}
                  </Button>
                </div>
                {editPayment ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={paymentStatusDraft} onValueChange={setPaymentStatusDraft}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                        <SelectItem value="PARTIAL">Partial</SelectItem>
                        <SelectItem value="PAID">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0" value={paidDraft} onChange={(e) => setPaidDraft(e.target.value)}
                      placeholder="Amount paid" className="h-8 text-xs" />
                    <Button size="sm" className="col-span-2 h-7 gap-1" onClick={savePayment} disabled={updateMutation.isPending}>
                      <Save className="h-3 w-3" /> Save payment
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PaymentStatusBadge status={r.paymentStatus} />
                      <span className="text-sm">
                        {formatCurrency(r.paid)} / {formatCurrency(r.total)}
                      </span>
                    </div>
                    {r.total - r.paid > 0 && (
                      <span className="text-xs font-medium text-rose-600">
                        Due {formatCurrency(r.total - r.paid)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Received</p>
                  <p className="mt-1 text-xs font-medium">{formatDate(r.receivedAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Completed</p>
                  <p className="mt-1 text-xs font-medium">{r.completedAt ? formatDate(r.completedAt) : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Delivered</p>
                  <p className="mt-1 text-xs font-medium">{r.deliveredAt ? formatDate(r.deliveredAt) : "—"}</p>
                </div>
              </div>

              {/* Image */}
              {r.imageUrl && (
                <div className="overflow-hidden rounded-xl border">
                  <img src={r.imageUrl} alt="Repair" className="max-h-60 w-full object-cover" />
                </div>
              )}

              {/* Notes */}
              {r.notes && (
                <div className="rounded-xl border bg-card p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="text-sm">{r.notes}</p>
                </div>
              )}

              {/* Danger zone */}
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="ghost" className="gap-1 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete ticket
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}

        {r && (
          <AddPartDialog open={addPartOpen} onOpenChange={setAddPartOpen} repairId={r.id} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban board
// ─────────────────────────────────────────────────────────────────────────────
function KanbanCard({ repair, onClick }: { repair: RepairJob; onClick: () => void }) {
  const meta = COLUMN_META[repair.status as RepairStatus] ?? COLUMN_META.RECEIVED;
  const due = repair.total - repair.paid;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={`group w-full rounded-xl border bg-card p-3 text-left shadow-soft transition hover:shadow-md hover:ring-2 ${meta.ring}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] font-bold text-muted-foreground">{repair.ticketNo}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(repair.receivedAt)}
        </span>
      </div>
      <p className="mb-1 text-sm font-semibold leading-snug line-clamp-2">{repair.problem}</p>
      <p className="mb-2 text-[11px] text-muted-foreground">
        {repair.model ? `${repair.model.brand?.name ?? ""} ${repair.model.name}`.trim() : "No model"}
      </p>
      <div className="mb-2 flex items-center gap-1.5">
        <TechAvatar name={repair.customer?.name} />
        <span className="truncate text-[11px] font-medium">{repair.customer?.name ?? "Walk-in"}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        <div className="flex items-center gap-1">
          <TechAvatar name={repair.technician?.name} />
          {due > 0 && (
            <Badge variant="outline" className="bg-rose-500/10 px-1.5 py-0 text-[9px] text-rose-600">
              Due {formatCurrency(due)}
            </Badge>
          )}
        </div>
        <span className="text-[11px] font-semibold">{formatCurrency(repair.total)}</span>
      </div>
    </motion.button>
  );
}

function KanbanColumn({
  status, repairs, onCardClick,
}: { status: RepairStatus; repairs: RepairJob[]; onCardClick: (r: RepairJob) => void }) {
  const meta = COLUMN_META[status];
  const Icon = meta.icon;
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col rounded-2xl border bg-muted/30 sm:w-[300px]">
      <div className="flex items-center justify-between gap-2 rounded-t-2xl border-b bg-card/50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.chip}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className={`text-xs font-semibold ${meta.accent}`}>{meta.label}</p>
            <p className="text-[10px] text-muted-foreground">{repairs.length} {repairs.length === 1 ? "ticket" : "tickets"}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.chip}`}>{repairs.length}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2.5">
          <AnimatePresence>
            {repairs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Icon className="mb-1.5 h-5 w-5 text-muted-foreground/40" />
                <p className="text-[10px] text-muted-foreground/60">No tickets</p>
              </div>
            ) : (
              repairs.map((r) => (
                <KanbanCard key={r.id} repair={r} onClick={() => onCardClick(r)} />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

function KanbanBoard({
  repairs, loading, onCardClick,
}: { repairs: RepairJob[]; loading: boolean; onCardClick: (r: RepairJob) => void }) {
  const grouped = useMemo(() => {
    const map: Record<RepairStatus, RepairJob[]> = {
      RECEIVED: [], DIAGNOSED: [], WAITING_PARTS: [], REPAIRING: [], COMPLETED: [], DELIVERED: [],
    };
    for (const r of repairs) {
      if (r.status in map) map[r.status as RepairStatus].push(r);
    }
    return map;
  }, [repairs]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_FLOW.map((s) => (
          <div key={s} className="w-[280px] shrink-0 space-y-2 rounded-2xl border bg-muted/30 p-2.5 sm:w-[300px]">
            <div className="h-9 animate-pulse rounded-lg bg-muted" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (repairs.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="No repair tickets yet"
        description="Create your first repair ticket to start tracking jobs on the kanban board."
      />
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 [scrollbar-width:thin]">
      {STATUS_FLOW.map((s) => (
        <KanbanColumn key={s} status={s} repairs={grouped[s]} onCardClick={onCardClick} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Damaged Inventory tab
// ─────────────────────────────────────────────────────────────────────────────
function DamageReasonBadge({ reason }: { reason: string }) {
  const map: Record<string, string> = {
    BROKEN: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    DEAD: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    WARRANTY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    RETURNED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    REJECTED: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    LOST: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    DISPOSED: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-medium ${map[reason] ?? "bg-muted"}`}>
      {reason.toLowerCase()}
    </Badge>
  );
}

function RecordDamageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const productsQ = useQuery<{ data: Product[] }>({
    queryKey: ["damage-product-search", search],
    queryFn: () => api.get(`/products?q=${encodeURIComponent(search)}&pageSize=20`),
    enabled: open,
    staleTime: 10_000,
  });
  const products = productsQ.data?.data ?? [];

  const handleSubmit = async () => {
    if (!selectedId) { toast.error("Select a product"); return; }
    if (!reason) { toast.error("Select a damage reason"); return; }
    setSaving(true);
    try {
      await api.post("/damaged", {
        productId: selectedId,
        qty: Number(qty) || 1,
        reason,
        note: note.trim() || undefined,
        imageUrl: imageUrl || undefined,
      });
      toast.success("Damage recorded · stock deducted");
      qc.invalidateQueries({ queryKey: ["damaged"] });
      qc.invalidateQueries({ queryKey: ["damaged-stats"] });
      setSearch(""); setSelectedId(""); setSelectedProduct(null);
      setQty("1"); setReason(""); setNote(""); setImageUrl(null);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 p-5">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <PackageX className="h-4 w-4" />
            </div>
            Record Damaged Inventory
          </DialogTitle>
          <DialogDescription>Stock will be deducted and a damage movement logged.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 p-5">
            {/* product search */}
            {!selectedProduct ? (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Search Product</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, SKU, model..." className="pl-9" autoFocus />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border">
                  {productsQ.isLoading ? (
                    <div className="p-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
                  ) : products.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No products found</div>
                  ) : (
                    products.map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedId(p.id); setSelectedProduct(p); }}
                        className="flex w-full items-center gap-2 border-b px-3 py-2 text-left transition last:border-b-0 hover:bg-muted/50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold">
                          {p.brand?.name?.[0] ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.sku} · stock {p.stock}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
                  {selectedProduct.brand?.name?.[0] ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{selectedProduct.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedProduct.sku} · stock {selectedProduct.stock} · {formatCurrency(selectedProduct.purchasePrice)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => { setSelectedProduct(null); setSelectedId(""); }}
                >
                  Change
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Quantity</Label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reason <span className="text-rose-500">*</span></Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {DAMAGE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What happened? (optional)" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Image (optional)</Label>
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <div className="group relative h-16 w-16 overflow-hidden rounded-lg border">
                    <img src={imageUrl} alt="damage" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setImageUrl(null)}
                      className="absolute right-0.5 top-0.5 rounded bg-black/50 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <ImageUpload value={null} onChange={setImageUrl} label="Upload" className="w-16" />
                )}
                <p className="text-[11px] text-muted-foreground">Photo of the damaged item</p>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="border-t bg-muted/30 p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !selectedId || !reason} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageX className="h-4 w-4" />}
            Record Damage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DamagedTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (reasonFilter) p.set("reason", reasonFilter);
    p.set("page", String(page));
    p.set("pageSize", "50");
    return p.toString();
  }, [q, reasonFilter, page]);

  const damagedQ = useQuery<{ data: DamagedItem[]; total: number }>({
    queryKey: ["damaged", queryStr],
    queryFn: () => api.get(`/damaged?${queryStr}`),
  });
  const items = damagedQ.data?.data ?? [];

  // Stats — derived from a separate fetch of all (no filter)
  const statsQ = useQuery<{ data: DamagedItem[] }>({
    queryKey: ["damaged-stats"],
    queryFn: () => api.get(`/damaged?pageSize=200`),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const all = statsQ.data?.data ?? [];
    let units = 0, value = 0;
    const byReason: Record<string, { reason: string; units: number; value: number }> = {};
    for (const d of all) {
      units += d.qty;
      const lineValue = d.qty * (d.product?.purchasePrice ?? 0);
      value += lineValue;
      if (!byReason[d.reason]) byReason[d.reason] = { reason: d.reason, units: 0, value: 0 };
      byReason[d.reason].units += d.qty;
      byReason[d.reason].value += lineValue;
    }
    const reasonData = Object.values(byReason).sort((a, b) => b.units - a.units);
    return { units, value, reasonData, count: all.length };
  }, [statsQ.data]);

  const columns: Column<DamagedItem & Record<string, unknown>>[] = [
    {
      key: "product", header: "Product", className: "min-w-[220px]",
      render: (d) => (
        <div className="flex items-center gap-2.5">
          {d.imageUrl ? (
            <img src={d.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border object-cover" />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">
              {d.product?.brand?.name?.[0] ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{d.product?.name ?? "Unknown"}</p>
            <p className="text-[11px] text-muted-foreground">{d.product?.sku ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "qty", header: "Qty", className: "min-w-[80px]",
      render: (d) => <Badge variant="secondary" className="font-semibold">{d.qty} unit{d.qty > 1 ? "s" : ""}</Badge>,
    },
    {
      key: "reason", header: "Reason", className: "min-w-[120px]",
      render: (d) => <DamageReasonBadge reason={d.reason} />,
    },
    {
      key: "value", header: "Value Lost", className: "min-w-[120px] text-right",
      render: (d) => (
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          {formatCurrency(d.qty * (d.product?.purchasePrice ?? 0))}
        </span>
      ),
    },
    {
      key: "date", header: "Date", className: "min-w-[140px]",
      render: (d) => <span className="text-xs">{formatDateTime(d.date)}</span>,
    },
    {
      key: "note", header: "Note", className: "min-w-[180px]",
      render: (d) => <span className="line-clamp-1 text-xs text-muted-foreground">{d.note ?? "—"}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Damaged Units" value={stats.units} icon={PackageX} accent="rose" subtitle={`${stats.count} record${stats.count === 1 ? "" : "s"}`} />
        <StatCard label="Damaged Value" value={formatCurrency(stats.value)} icon={Wallet} accent="amber" subtitle="At purchase cost" />
        <StatCard label="Most Common Reason" value={stats.reasonData[0]?.reason ?? "—"} icon={AlertTriangle} accent="purple"
          subtitle={stats.reasonData[0] ? `${stats.reasonData[0].units} units` : "No data"} />
        <StatCard label="Avg per Incident" value={stats.count ? (stats.units / stats.count).toFixed(1) : "0"} icon={TrendingUp} accent="teal" subtitle="Units per record" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Reason breakdown donut */}
        <Card className="p-5 shadow-card lg:col-span-1">
          <div className="mb-2">
            <h3 className="text-sm font-semibold">By Reason Breakdown</h3>
            <p className="text-xs text-muted-foreground">Units damaged per reason</p>
          </div>
          {statsQ.isLoading ? (
            <div className="h-[200px] animate-pulse rounded-lg bg-muted" />
          ) : stats.reasonData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
              No damaged inventory recorded
            </div>
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.reasonData}
                      dataKey="units" nameKey="reason"
                      innerRadius={50} outerRadius={80} paddingAngle={2}
                    >
                      {stats.reasonData.map((_, i) => (
                        <RechartsCell key={i} fill={DAMAGE_CHART_COLORS[i % DAMAGE_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", fontSize: 12 }}
                      formatter={(v: number, name: string) => [`${v} units`, name.toLowerCase()]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {stats.reasonData.slice(0, 5).map((r, i) => (
                  <div key={r.reason} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: DAMAGE_CHART_COLORS[i % DAMAGE_CHART_COLORS.length] }} />
                      <span className="capitalize">{r.reason.toLowerCase()}</span>
                    </div>
                    <span className="font-medium">{r.units} · {formatCurrency(r.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Table */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search products..." className="pl-9" />
              </div>
              <Select value={reasonFilter} onValueChange={(v) => { setReasonFilter(v === "ALL" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All reasons" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All reasons</SelectItem>
                  {DAMAGE_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Record Damage
            </Button>
          </div>
          <DataTable
            columns={columns}
            data={items as (DamagedItem & Record<string, unknown>)[]}
            loading={damagedQ.isLoading}
            pagination
            page={page}
            pageSize={50}
            total={damagedQ.data?.total ?? 0}
            onPageChange={setPage}
            emptyTitle="No damaged inventory"
            emptyDescription="Record damage to deduct stock and track losses."
            rowKey={(d) => d.id}
          />
        </div>
      </div>

      <RecordDamageDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tickets tab (Kanban + Table toggle)
// ─────────────────────────────────────────────────────────────────────────────
function TicketsTab({ onNewTicket }: { onNewTicket: () => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (statusFilter) p.set("status", statusFilter);
    if (techFilter) p.set("technicianId", techFilter);
    p.set("page", String(page));
    p.set("pageSize", "100");
    return p.toString();
  }, [q, statusFilter, techFilter, page]);

  const repairsQ = useQuery<{ data: RepairJob[]; total: number }>({
    queryKey: ["repairs", queryStr],
    queryFn: () => api.get(`/repairs?${queryStr}`),
  });
  const repairs = repairsQ.data?.data ?? [];

  // Stats — fetch all repairs for aggregation
  const statsQ = useQuery<{ data: RepairJob[] }>({
    queryKey: ["repairs-stats"],
    queryFn: () => api.get(`/repairs?pageSize=200`),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const all = statsQ.data?.data ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let pending = 0, inProgress = 0, completedMonth = 0, revenue = 0;
    for (const r of all) {
      if (r.status === "RECEIVED" || r.status === "DIAGNOSED" || r.status === "WAITING_PARTS") pending++;
      if (r.status === "REPAIRING") inProgress++;
      const t = new Date(r.receivedAt).getTime();
      if (r.status === "COMPLETED" && t >= monthStart) {
        completedMonth++;
        revenue += r.paid;
      }
      if (r.status === "DELIVERED" && r.deliveredAt && new Date(r.deliveredAt).getTime() >= monthStart) {
        revenue += r.paid;
      }
    }
    return { pending, inProgress, completedMonth, revenue, total: all.length };
  }, [statsQ.data]);

  const techniciansQ = useQuery<User[]>({
    queryKey: ["users-list"],
    queryFn: () => api.get("/users"),
    staleTime: 60_000,
  });

  const openDetail = (r: RepairJob) => setDetailId(r.id);

  const columns: Column<RepairJob & Record<string, unknown>>[] = [
    {
      key: "ticketNo", header: "Ticket", className: "min-w-[140px]",
      render: (r) => (
        <div>
          <p className="font-mono text-xs font-bold">{r.ticketNo}</p>
          <p className="text-[11px] text-muted-foreground">{timeAgo(r.receivedAt)}</p>
        </div>
      ),
    },
    {
      key: "customer", header: "Customer", className: "min-w-[150px]",
      render: (r) => (
        <div className="flex items-center gap-2">
          <TechAvatar name={r.customer?.name} />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{r.customer?.name ?? "Walk-in"}</p>
            <p className="text-[10px] text-muted-foreground">{r.customer?.phone ?? "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "model", header: "Device", className: "min-w-[160px]",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">
              {r.model ? `${r.model.brand?.name ?? ""} ${r.model.name}`.trim() : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground line-clamp-1">{r.problem}</p>
          </div>
        </div>
      ),
    },
    {
      key: "technician", header: "Technician", className: "min-w-[130px]",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <TechAvatar name={r.technician?.name} />
          <span className="truncate text-xs">{r.technician?.name ?? "Unassigned"}</span>
        </div>
      ),
    },
    {
      key: "status", header: "Status", className: "min-w-[120px]",
      render: (r) => <RepairStatusBadge status={r.status} />,
    },
    {
      key: "total", header: "Total", className: "min-w-[110px] text-right",
      render: (r) => (
        <div className="text-right">
          <p className="text-sm font-bold">{formatCurrency(r.total)}</p>
          <PaymentStatusBadge status={r.paymentStatus} />
        </div>
      ),
    },
    {
      key: "actions", header: "", className: "text-right",
      render: (r) => (
        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={(e) => { e.stopPropagation(); openDetail(r); }}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pending Repairs" value={stats.pending} icon={ClipboardList} accent="teal" subtitle="Awaiting parts/action" />
        <StatCard label="In Progress" value={stats.inProgress} icon={Cog} accent="purple" subtitle="Being repaired now" />
        <StatCard label="Completed This Month" value={stats.completedMonth} icon={CheckCircle2} accent="emerald" subtitle="Tickets finished" />
        <StatCard label="Repair Revenue" value={formatCurrency(stats.revenue)} icon={Wallet} accent="amber" subtitle="Collected this month" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search tickets, customers, IMEI..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {REPAIR_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={techFilter} onValueChange={(v) => { setTechFilter(v === "ALL" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All technicians" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All technicians</SelectItem>
              {(techniciansQ.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View toggle */}
        <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border bg-card p-1">
          <button
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="h-3.5 w-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              view === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" /> Table
          </button>
        </div>
      </div>

      {/* Body */}
      {view === "kanban" ? (
        <KanbanBoard repairs={repairs} loading={repairsQ.isLoading} onCardClick={openDetail} />
      ) : (
        <DataTable
          columns={columns}
          data={repairs as (RepairJob & Record<string, unknown>)[]}
          loading={repairsQ.isLoading}
          pagination
          page={page}
          pageSize={100}
          total={repairsQ.data?.total ?? 0}
          onPageChange={setPage}
          onRowClick={openDetail}
          emptyTitle="No repair tickets"
          emptyDescription="Create your first ticket to start tracking repairs."
          rowKey={(r) => r.id}
        />
      )}

      {/* Hidden button — actual trigger is in parent header */}
      <button className="hidden" onClick={onNewTicket} aria-hidden data-new-ticket-trigger />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────
export function RepairsView() {
  const [tab, setTab] = useState<"tickets" | "damaged">("tickets");
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  // Shared data for the New Ticket dialog
  const customersQ = useQuery<Customer[]>({
    queryKey: ["customers-list"],
    queryFn: () => api.get("/customers"),
    staleTime: 60_000,
  });
  const modelsQ = useQuery<PhoneModel[]>({
    queryKey: ["models-list"],
    queryFn: () => api.get("/models"),
    staleTime: 60_000,
  });
  const techniciansQ = useQuery<User[]>({
    queryKey: ["users-list"],
    queryFn: () => api.get("/users"),
    staleTime: 60_000,
  });

  // Trigger the New Ticket dialog from inside TicketsTab via a custom event
  // (TicketsTab has its own toolbar but we want the header button to work too).
  const handleNewTicket = () => setNewTicketOpen(true);

  return (
    <div>
      <PageHeader
        title="Repair Jobs"
        description="Track repair tickets from intake to delivery, manage parts usage, and record damaged inventory."
        icon={Wrench}
        actions={
          <Button onClick={handleNewTicket} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "tickets" | "damaged")}>
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Tickets
          </TabsTrigger>
          <TabsTrigger value="damaged" className="gap-1.5">
            <PackageX className="h-3.5 w-3.5" /> Damaged Inventory
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tickets" className="mt-5">
          <TicketsTab onNewTicket={handleNewTicket} />
        </TabsContent>
        <TabsContent value="damaged" className="mt-5">
          <DamagedTab />
        </TabsContent>
      </Tabs>

      <NewTicketDialog
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        customers={customersQ.data ?? []}
        models={modelsQ.data ?? []}
        technicians={techniciansQ.data ?? []}
      />
    </div>
  );
}
