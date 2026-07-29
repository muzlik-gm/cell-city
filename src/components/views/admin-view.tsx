"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Plus, Trash2, UserCog, Users, Crown, Store, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

const RANKS = [
  { value: "FOUNDER", label: "Founder", desc: "Full access + can transfer ownership" },
  { value: "OWNER", label: "Owner", desc: "Full access + admin panel" },
  { value: "MANAGER", label: "Manager", desc: "All operations + reports" },
  { value: "SALES_STAFF", label: "Sales Staff", desc: "Home, Inventory, Sales, Repairs" },
  { value: "TECHNICIAN", label: "Technician", desc: "Home, Inventory, Repairs" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse", desc: "Home, Inventory, Purchases" },
];

const rankBadgeStyles: Record<string, string> = {
  FOUNDER: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  OWNER: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  MANAGER: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  SALES_STAFF: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  TECHNICIAN: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  WAREHOUSE_STAFF: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
};

export function AdminView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: "", email: "", password: "", phone: "", rank: "SALES_STAFF" });

  const employeesQ = useQuery({
    queryKey: ["company-employees"],
    queryFn: () => api.get<{ employees: any[]; canManage: boolean }>("/company/employees"),
  });

  const addEmp = useMutation({
    mutationFn: () => api.post("/company/employees", newEmp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-employees"] });
      toast.success("Employee added");
      setAddOpen(false);
      setNewEmp({ name: "", email: "", password: "", phone: "", rank: "SALES_STAFF" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRank = useMutation({
    mutationFn: ({ id, rank }: { id: string; rank: string }) => api.patch(`/company/employees/${id}`, { rank }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-employees"] }); toast.success("Rank updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/company/employees/${id}`, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-employees"] }); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmp = useMutation({
    mutationFn: (id: string) => api.del(`/company/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-employees"] }); toast.success("Employee removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const employees = employeesQ.data?.employees ?? [];
  const canManage = employeesQ.data?.canManage ?? false;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Admin Panel"
        description={`Manage employees and access for ${user?.activeCompany?.name ?? "your company"}`}
        icon={Shield}
        actions={canManage && (
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        )}
      />

      {/* Company info card */}
      <Card className="p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-emerald text-white shadow-soft">
            <Store className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{user?.activeCompany?.name}</h3>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {employees.length} employees</span>
              <Badge variant="outline" className="uppercase">{user?.activeCompany?.plan ?? "FREE"}</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Rank legend */}
      <Card className="p-5 shadow-soft">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <UserCog className="h-4 w-4" /> Rank Permissions
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RANKS.map((r) => (
            <div key={r.value} className="flex items-center gap-2 rounded-lg border p-2.5">
              <Badge variant="outline" className={rankBadgeStyles[r.value]}>{r.label}</Badge>
              <span className="text-xs text-muted-foreground">{r.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Employees list */}
      <Card className="p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Employees ({employees.length})
          </h3>
        </div>
        <div className="space-y-2">
          {employeesQ.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No employees yet.</p>
          ) : (
            employees.map((emp: any) => (
              <div key={emp.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {emp.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{emp.name}</p>
                    {(emp.rank === "OWNER" || emp.rank === "FOUNDER") && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.email}</span>
                    {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</span>}
                  </div>
                </div>
                {canManage && emp.rank !== "OWNER" && emp.rank !== "FOUNDER" ? (
                  <>
                    <Select value={emp.rank} onValueChange={(v) => updateRank.mutate({ id: emp.id, rank: v })}>
                      <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RANKS.filter((r) => r.value !== "FOUNDER" && r.value !== "OWNER").map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-9"
                      onClick={() => toggleActive.mutate({ id: emp.id, active: !emp.active })}>
                      {emp.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-9 text-destructive"
                      onClick={() => { if (confirm(`Remove ${emp.name}?`)) removeEmp.mutate(emp.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline" className={rankBadgeStyles[emp.rank]}>{emp.rankLabel}</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Add Employee dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="mb-1.5 block text-xs">Full Name *</Label><Input value={newEmp.name} onChange={(e) => setNewEmp((s) => ({ ...s, name: e.target.value }))} placeholder="Ali Raza" /></div>
            <div><Label className="mb-1.5 block text-xs">Email *</Label><Input type="email" value={newEmp.email} onChange={(e) => setNewEmp((s) => ({ ...s, email: e.target.value }))} placeholder="ali@cellcity.pk" /></div>
            <div><Label className="mb-1.5 block text-xs">Password *</Label><Input type="password" value={newEmp.password} onChange={(e) => setNewEmp((s) => ({ ...s, password: e.target.value }))} placeholder="Min 6 characters" /></div>
            <div><Label className="mb-1.5 block text-xs">Phone</Label><Input value={newEmp.phone} onChange={(e) => setNewEmp((s) => ({ ...s, phone: e.target.value }))} placeholder="+92 311 0000001" /></div>
            <div>
              <Label className="mb-1.5 block text-xs">Rank / Access Level</Label>
              <Select value={newEmp.rank} onValueChange={(v) => setNewEmp((s) => ({ ...s, rank: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANKS.filter((r) => r.value !== "FOUNDER" && r.value !== "OWNER").map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label} — {r.desc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={!newEmp.name || !newEmp.email || !newEmp.password || addEmp.isPending} onClick={() => addEmp.mutate()}>
              {addEmp.isPending ? "Adding…" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
