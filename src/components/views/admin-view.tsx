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
import { motion } from "framer-motion";

const RANKS = [
  { value: "OWNER", label: "Owner", desc: "Full access + admin panel" },
  { value: "MANAGER", label: "Manager", desc: "All operations + reports" },
  { value: "SALES_STAFF", label: "Sales Staff", desc: "Home, Inventory, Sales, Repairs" },
  { value: "TECHNICIAN", label: "Technician", desc: "Home, Inventory, Repairs" },
  { value: "WAREHOUSE_STAFF", label: "Warehouse", desc: "Home, Inventory, Purchases" },
];

const rankBadgeStyles: Record<string, string> = {
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
      toast.success("Employee added — they can now sign in with their Gmail");
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
        description={`Manage employees for ${user?.business?.name ?? "your business"}`}
        icon={Shield}
        actions={canManage && (
          <Button className="gap-1.5 shadow-soft active:scale-[0.98] transition-transform" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        )}
      />

      {/* Company info */}
      <Card className="overflow-hidden border-0 shadow-card">
        <div className="bg-gradient-to-r from-primary/5 to-transparent p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-emerald text-white shadow-soft">
              <Store className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">{user?.business?.name}</h3>
              <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{user?.business?.plan ?? "FREE"}</Badge>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {employees.length} employees</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Rank legend */}
      <Card className="border-0 shadow-card">
        <div className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <UserCog className="h-3.5 w-3.5" /> Access Levels
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {RANKS.map((r) => (
              <div key={r.value} className="flex items-center gap-2.5 rounded-xl border bg-muted/30 p-2.5 transition-colors hover:bg-muted/60">
                <Badge variant="outline" className={`text-[10px] ${rankBadgeStyles[r.value]}`}>{r.label}</Badge>
                <span className="text-[11px] text-muted-foreground">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Employees list */}
      <Card className="border-0 shadow-card">
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Team ({employees.length})
            </h3>
          </div>
          <div className="space-y-2">
            {employeesQ.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">No employees yet. Add your first team member.</p>
              </div>
            ) : (
              employees.map((emp: any) => (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {emp.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{emp.name}</p>
                      {emp.rank === "OWNER" && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {emp.email}</span>
                      {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {emp.phone}</span>}
                    </div>
                  </div>
                  {canManage && emp.rank !== "OWNER" ? (
                    <div className="flex items-center gap-1.5">
                      <Select value={emp.rank} onValueChange={(v) => updateRank.mutate({ id: emp.id, rank: v })}>
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RANKS.filter((r) => r.value !== "OWNER").map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleActive.mutate({ id: emp.id, active: !emp.active })}
                      >
                        {emp.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Remove ${emp.name}?`)) removeEmp.mutate(emp.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] ${rankBadgeStyles[emp.rank]}`}>{emp.rankLabel}</Badge>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Add Employee dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md border-0 shadow-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-1 block text-xs font-medium">Full Name *</Label>
              <Input value={newEmp.name} onChange={(e) => setNewEmp((s) => ({ ...s, name: e.target.value }))} placeholder="Ali Raza" className="h-10" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">Gmail / Email *</Label>
              <Input type="email" value={newEmp.email} onChange={(e) => setNewEmp((s) => ({ ...s, email: e.target.value.toLowerCase() }))} placeholder="ali@gmail.com" className="h-10" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">Password *</Label>
              <Input type="password" value={newEmp.password} onChange={(e) => setNewEmp((s) => ({ ...s, password: e.target.value }))} placeholder="Min 6 characters" className="h-10" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">Phone</Label>
              <Input value={newEmp.phone} onChange={(e) => setNewEmp((s) => ({ ...s, phone: e.target.value }))} placeholder="+92 311 0000001" className="h-10" />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">Access Level</Label>
              <Select value={newEmp.rank} onValueChange={(v) => setNewEmp((s) => ({ ...s, rank: v }))}>
                <SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANKS.filter((r) => r.value !== "OWNER").map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">{r.label} — {r.desc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="active:scale-[0.98] transition-transform">Cancel</Button>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button disabled={!newEmp.name || !newEmp.email || !newEmp.password || addEmp.isPending} onClick={() => addEmp.mutate()}>
                {addEmp.isPending ? "Adding…" : "Add Employee"}
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
