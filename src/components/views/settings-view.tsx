"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { toast } from "sonner";
import { downloadBlob, formatDate, initials } from "@/lib/format";
import {
  Settings as SettingsIcon,
  Building2,
  ReceiptText,
  Palette,
  Users,
  DatabaseBackup,
  Save,
  Sun,
  Moon,
  Monitor,
  Plus,
  ShieldCheck,
  Download,
  Upload,
  Info,
  CheckCircle2,
} from "lucide-react";

// SSR-safe mounted flag (next-themes hydration pattern via useSyncExternalStore).
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

type Row = Record<string, unknown>;

const ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "MANAGER", label: "Manager" },
  { value: "SALES_STAFF", label: "Sales Staff" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse Staff" },
];

const roleBadgeStyle: Record<string, string> = {
  OWNER: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  MANAGER: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  SALES_STAFF: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  TECHNICIAN: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  WAREHOUSE_STAFF: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

const PERMISSION_MATRIX = [
  { module: "Dashboard", owner: "full", manager: "full", sales: "view", technician: "view", warehouse: "view" },
  { module: "Inventory", owner: "full", manager: "full", sales: "view", technician: "view", warehouse: "full" },
  { module: "Sales / POS", owner: "full", manager: "full", sales: "full", technician: "—", warehouse: "—" },
  { module: "Purchases", owner: "full", manager: "full", sales: "—", technician: "—", warehouse: "view" },
  { module: "Repairs", owner: "full", manager: "full", sales: "view", technician: "full", warehouse: "view" },
  { module: "Damaged Stock", owner: "full", manager: "full", sales: "—", technician: "view", warehouse: "full" },
  { module: "Reports", owner: "full", manager: "full", sales: "view", technician: "—", warehouse: "—" },
  { module: "Settings", owner: "full", manager: "view", sales: "—", technician: "—", warehouse: "—" },
] as const;

export function SettingsView() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("business");

  // ── Settings fetch ──────────────────────────────────────────────────────
  const { data: settings, isLoading, isError, error, refetch } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: () => api.get("/settings"),
    staleTime: 60_000,
  });

  // ── Local form state for Business + Invoice tabs ────────────────────────
  const [bizForm, setBizForm] = useState<Record<string, string>>({});
  const [invForm, setInvForm] = useState<Record<string, string>>({});
  const [appearance, setAppearance] = useState<Record<string, string>>({ language: "en" });
  const mounted = useMounted();

  // Hydrate forms from server settings using the React 19
  // "adjust state when props change" pattern (no effect needed).
  const [lastSettings, setLastSettings] = useState<Record<string, string> | null>(null);
  if (settings && settings !== lastSettings) {
    setLastSettings(settings);
    setBizForm({
      business_name: settings.business_name ?? "",
      business_phone: settings.business_phone ?? "",
      business_email: settings.business_email ?? "",
      business_address: settings.business_address ?? "",
      currency: settings.currency ?? "PKR",
      currency_symbol: settings.currency_symbol ?? "Rs",
      tax_rate: settings.tax_rate ?? "0",
      tax_name: settings.tax_name ?? "Sales Tax",
    });
    setInvForm({
      invoice_prefix: settings.invoice_prefix ?? "INV",
      po_prefix: settings.po_prefix ?? "PO",
      ticket_prefix: settings.ticket_prefix ?? "RPR",
      low_stock_threshold: settings.low_stock_threshold ?? "5",
    });
    setAppearance({ language: settings.language ?? "en" });
  }

  const updateSettings = useMutation({
    mutationFn: (body: Record<string, string>) => api.put<Record<string, string>>("/settings", body),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSaveBusiness = useCallback(() => {
    updateSettings.mutate(bizForm);
  }, [bizForm, updateSettings]);

  const handleSaveInvoice = useCallback(() => {
    updateSettings.mutate(invForm);
  }, [invForm, updateSettings]);

  const handleSaveAppearance = useCallback(() => {
    updateSettings.mutate({ language: appearance.language, theme: theme ?? "light" });
  }, [appearance, theme, updateSettings]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={error?.message ?? "Failed to load settings"} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your business, invoices, appearance, users, and backups"
        icon={SettingsIcon}
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="business" className="gap-1.5"><Building2 className="h-4 w-4" /> Business</TabsTrigger>
          <TabsTrigger value="invoice" className="gap-1.5"><ReceiptText className="h-4 w-4" /> Invoice</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><Palette className="h-4 w-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5"><DatabaseBackup className="h-4 w-4" /> Backup</TabsTrigger>
        </TabsList>

        {/* ── Business tab ─────────────────────────────────────────── */}
        <TabsContent value="business">
          <Card className="p-6 shadow-card">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold">Business Profile</h3>
                <p className="text-xs text-muted-foreground">This information appears on invoices and receipts</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Business Name" htmlFor="business_name">
                <Input id="business_name" value={bizForm.business_name ?? ""} onChange={(e) => setBizForm({ ...bizForm, business_name: e.target.value })} placeholder="MobileCare Spare Parts" />
              </Field>
              <Field label="Phone" htmlFor="business_phone">
                <Input id="business_phone" value={bizForm.business_phone ?? ""} onChange={(e) => setBizForm({ ...bizForm, business_phone: e.target.value })} placeholder="+92 300 1234567" />
              </Field>
              <Field label="Email" htmlFor="business_email">
                <Input id="business_email" type="email" value={bizForm.business_email ?? ""} onChange={(e) => setBizForm({ ...bizForm, business_email: e.target.value })} placeholder="info@business.com" />
              </Field>
              <Field label="Address" htmlFor="business_address">
                <Input id="business_address" value={bizForm.business_address ?? ""} onChange={(e) => setBizForm({ ...bizForm, business_address: e.target.value })} placeholder="Main Market, City" />
              </Field>
              <Field label="Currency Code" htmlFor="currency">
                <Input id="currency" value={bizForm.currency ?? ""} onChange={(e) => setBizForm({ ...bizForm, currency: e.target.value })} placeholder="PKR" />
              </Field>
              <Field label="Currency Symbol" htmlFor="currency_symbol">
                <Input id="currency_symbol" value={bizForm.currency_symbol ?? ""} onChange={(e) => setBizForm({ ...bizForm, currency_symbol: e.target.value })} placeholder="Rs" />
              </Field>
              <Field label="Tax Rate (%)" htmlFor="tax_rate">
                <Input id="tax_rate" type="number" min="0" step="0.1" value={bizForm.tax_rate ?? ""} onChange={(e) => setBizForm({ ...bizForm, tax_rate: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Tax Name" htmlFor="tax_name">
                <Input id="tax_name" value={bizForm.tax_name ?? ""} onChange={(e) => setBizForm({ ...bizForm, tax_name: e.target.value })} placeholder="Sales Tax" />
              </Field>
            </div>
            <Separator className="my-5" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Changes apply to all future invoices and reports.</p>
              <Button onClick={handleSaveBusiness} disabled={updateSettings.isPending} className="gap-1.5">
                <Save className="h-4 w-4" /> {updateSettings.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ── Invoice tab ──────────────────────────────────────────── */}
        <TabsContent value="invoice">
          <Card className="p-6 shadow-card">
            <div className="mb-5 flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              <div>
                <h3 className="text-base font-semibold">Invoice & Document Prefixes</h3>
                <p className="text-xs text-muted-foreground">Configure auto-numbering for invoices, POs, and repair tickets</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Invoice Prefix" htmlFor="invoice_prefix" hint="Used for sales invoices">
                <Input id="invoice_prefix" value={invForm.invoice_prefix ?? ""} onChange={(e) => setInvForm({ ...invForm, invoice_prefix: e.target.value })} placeholder="INV" />
              </Field>
              <Field label="Purchase Order Prefix" htmlFor="po_prefix" hint="Used for supplier purchases">
                <Input id="po_prefix" value={invForm.po_prefix ?? ""} onChange={(e) => setInvForm({ ...invForm, po_prefix: e.target.value })} placeholder="PO" />
              </Field>
              <Field label="Repair Ticket Prefix" htmlFor="ticket_prefix" hint="Used for repair jobs">
                <Input id="ticket_prefix" value={invForm.ticket_prefix ?? ""} onChange={(e) => setInvForm({ ...invForm, ticket_prefix: e.target.value })} placeholder="RPR" />
              </Field>
              <Field label="Low Stock Threshold" htmlFor="low_stock_threshold" hint="Default minimum stock level">
                <Input id="low_stock_threshold" type="number" min="0" value={invForm.low_stock_threshold ?? ""} onChange={(e) => setInvForm({ ...invForm, low_stock_threshold: e.target.value })} placeholder="5" />
              </Field>
            </div>

            <Separator className="my-5" />
            <div className="rounded-lg bg-muted/40 p-4">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary" className="font-mono">{invForm.invoice_prefix ?? "INV"}-20250115-001</Badge>
                <Badge variant="secondary" className="font-mono">{invForm.po_prefix ?? "PO"}-20250115-001</Badge>
                <Badge variant="secondary" className="font-mono">{invForm.ticket_prefix ?? "RPR"}-202501-0001</Badge>
              </div>
            </div>

            <Separator className="my-5" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Existing documents keep their numbers.</p>
              <Button onClick={handleSaveInvoice} disabled={updateSettings.isPending} className="gap-1.5">
                <Save className="h-4 w-4" /> {updateSettings.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ── Appearance tab ───────────────────────────────────────── */}
        <TabsContent value="appearance">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-6 shadow-card lg:col-span-2">
              <div className="mb-5 flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold">Theme & Language</h3>
                  <p className="text-xs text-muted-foreground">Customize the visual appearance of the app</p>
                </div>
              </div>

              <Field label="Theme" hint="Choose your preferred color scheme">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isActive = mounted && theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition ${
                          isActive ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30 text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Separator className="my-5" />

              <Field label="Language" hint="Interface language (Urdu support is visual only)">
                <Select value={appearance.language} onValueChange={(v) => setAppearance({ ...appearance, language: v })}>
                  <SelectTrigger className="w-full sm:w-[260px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ur">اردو (Urdu)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Separator className="my-5" />
              <div className="flex justify-end">
                <Button onClick={handleSaveAppearance} disabled={updateSettings.isPending} className="gap-1.5">
                  <Save className="h-4 w-4" /> {updateSettings.isPending ? "Saving…" : "Save Appearance"}
                </Button>
              </div>
            </Card>

            {/* Color system preview swatch */}
            <Card className="p-6 shadow-card">
              <div className="mb-4">
                <h3 className="text-sm font-semibold">Color System</h3>
                <p className="text-xs text-muted-foreground">Emerald design system</p>
              </div>
              <div className="space-y-3">
                <Swatch label="Primary" token="primary" />
                <Swatch label="Accent" token="accent" />
                <Swatch label="Muted" token="muted" />
                <Swatch label="Card" token="card" />
                <Swatch label="Border" token="border" />
                <Swatch label="Destructive" token="destructive" />
              </div>
              <Separator className="my-4" />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Chart Palette</p>
                <div className="flex flex-wrap gap-1.5">
                  {["oklch(0.55 0.13 162)", "oklch(0.65 0.18 60)", "oklch(0.6 0.2 300)", "oklch(0.7 0.15 200)", "oklch(0.62 0.22 20)", "oklch(0.72 0.16 180)"].map((c) => (
                    <div key={c} className="h-6 w-6 rounded-md border border-border" style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Users tab ────────────────────────────────────────────── */}
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        {/* ── Backup tab ───────────────────────────────────────────── */}
        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────
function Field({
  label, htmlFor, hint, children,
}: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Color swatch ──────────────────────────────────────────────────────────
function Swatch({ label, token }: { label: string; token: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-8 w-8 shrink-0 rounded-lg border border-border shadow-soft"
        style={{ background: `var(--${token})` }}
      />
      <div className="flex-1">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] font-mono text-muted-foreground">var(--{token})</p>
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  avatarUrl: string | null;
  active: boolean;
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users, isLoading, isError, error, refetch } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/users?active=false"),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "SALES_STAFF", phone: "" });

  const createUser = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      // The existing /api/users route does not expose POST yet (out of scope for this task).
      // We attempt POST anyway; if it 405s we surface a friendly message.
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 405) {
        throw new Error("User creation endpoint is not configured yet. Add a POST handler to /api/users to enable.");
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setAddOpen(false);
      setForm({ name: "", email: "", role: "SALES_STAFF", phone: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    createUser.mutate({ ...form });
  };

  const columns: Column<Row>[] = [
    {
      key: "user",
      header: "User",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
            {initials((r.name as string) ?? "?")}
          </div>
          <div>
            <p className="font-medium">{r.name as string}</p>
            <p className="text-xs text-muted-foreground">{r.email as string}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (r) => (
      <Badge variant="outline" className={roleBadgeStyle[r.role as string] ?? ""}>
        {ROLES.find((ro) => ro.value === r.role)?.label ?? (r.role as string)}
      </Badge>
    ) },
    { key: "phone", header: "Phone", render: (r) => <span className="text-sm">{(r.phone as string) ?? "—"}</span> },
    { key: "active", header: "Status", render: (r) => (
      r.active ? (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Active</Badge>
      ) : (
        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
      )
    ) },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Team Members</h3>
            <p className="text-xs text-muted-foreground">Manage user accounts and roles</p>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </div>
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={error?.message ?? "Failed to load users"} onRetry={() => refetch()} />
        ) : !users || users.length === 0 ? (
          <EmptyState icon={Users} title="No users" />
        ) : (
          <DataTable
            columns={columns}
            data={users as unknown as Row[]}
            rowKey={(r) => r.id as string}
          />
        )}
      </Card>

      <Card className="p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Role Permissions Matrix</h3>
            <p className="text-xs text-muted-foreground">Read-only reference of what each role can access</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-left font-semibold">Module</th>
                <th className="px-3 py-2 text-center font-semibold">Owner</th>
                <th className="px-3 py-2 text-center font-semibold">Manager</th>
                <th className="px-3 py-2 text-center font-semibold">Sales</th>
                <th className="px-3 py-2 text-center font-semibold">Technician</th>
                <th className="px-3 py-2 text-center font-semibold">Warehouse</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.module} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{row.module}</td>
                  <PermCell value={row.owner} />
                  <PermCell value={row.manager} />
                  <PermCell value={row.sales} />
                  <PermCell value={row.technician} />
                  <PermCell value={row.warehouse} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">full</Badge> Full access</span>
          <span className="flex items-center gap-1"><Badge variant="outline" className="bg-amber-500/10 text-amber-600">view</Badge> Read-only</span>
          <span className="flex items-center gap-1"><Badge variant="outline" className="bg-muted">—</Badge> No access</span>
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new team member account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Full Name" htmlFor="u-name">
              <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </Field>
            <Field label="Email" htmlFor="u-email">
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@business.com" />
            </Field>
            <Field label="Role" htmlFor="u-role">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="u-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Phone" htmlFor="u-phone">
              <Input id="u-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 1234567" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createUser.isPending} className="gap-1.5">
              <Plus className="h-4 w-4" /> {createUser.isPending ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermCell({ value }: { value: string }) {
  if (value === "full") return <td className="px-3 py-2 text-center"><Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">full</Badge></td>;
  if (value === "view") return <td className="px-3 py-2 text-center"><Badge variant="outline" className="bg-amber-500/10 text-amber-600">view</Badge></td>;
  return <td className="px-3 py-2 text-center text-muted-foreground">—</td>;
}

// ── Backup tab ────────────────────────────────────────────────────────────
function BackupTab() {
  const [exporting, setExporting] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error(`Backup failed (${res.status})`);
      const json = await res.json();
      const filename = `partshub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadBlob(JSON.stringify(json, null, 2), filename, "application/json");
      toast.success(`Backup downloaded (${json.counts.products} products, ${json.counts.sales} sales)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = () => {
    if (!restoreFile) {
      toast.error("Select a backup file first");
      return;
    }
    toast.info("Restore is disabled in demo mode — contact your administrator to perform a database restore.");
    setRestoreFile(null);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="text-base font-semibold">Export Database</h3>
            <p className="text-xs text-muted-foreground">Download a full JSON snapshot of all your data</p>
          </div>
        </div>
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">What&apos;s included:</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>• All products, brands, models, part types</li>
            <li>• Sales + line items, purchases + items</li>
            <li>• Repair jobs + parts used</li>
            <li>• Customers, suppliers, users (no passwords)</li>
            <li>• Inventory movements, damaged stock, price history</li>
            <li>• All business settings</li>
          </ul>
        </div>
        <Button onClick={handleExport} disabled={exporting} className="mt-4 w-full gap-1.5">
          <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export Database (JSON)"}
        </Button>
      </Card>

      <Card className="p-6 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-amber-600" />
          <div>
            <h3 className="text-base font-semibold">Restore Database</h3>
            <p className="text-xs text-muted-foreground">Import data from a previous backup</p>
          </div>
        </div>
        <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Drop backup file here</p>
          <p className="text-xs text-muted-foreground">or click to browse (.json)</p>
          <input
            type="file"
            accept="application/json,.json"
            className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground file:hover:bg-primary/90"
            onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
          />
          {restoreFile && (
            <p className="mt-2 truncate text-xs text-muted-foreground">Selected: {restoreFile.name}</p>
          )}
        </div>
        <Button onClick={handleRestore} variant="outline" disabled={!restoreFile} className="mt-4 w-full gap-1.5">
          <Upload className="h-4 w-4" /> Restore from File
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Restore is disabled in demo mode for data safety.</p>
      </Card>

      <Card className="p-6 shadow-card lg:col-span-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Data Safety Information</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Your data is stored locally in SQLite. Regular exports are recommended — daily for active shops, weekly otherwise.
              Exported JSON files can be re-imported on any PartsHub instance. For production deployments, configure automated
              filesystem-level backups of the SQLite database file as well. Last export: <span className="font-medium text-foreground">not yet exported from this session</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Badge variant="secondary">SQLite</Badge>
              <Badge variant="secondary">Prisma ORM</Badge>
              <Badge variant="secondary">No PII shared externally</Badge>
              <Badge variant="secondary">Auto-migrations on schema changes</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
