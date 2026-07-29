"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Layers, Smartphone, Package, Link2, X, Check } from "lucide-react";
import { toast } from "sonner";

type Tab = "models" | "brands" | "parts" | "compat";

export function CatalogManager() {
  const [tab, setTab] = useState<Tab>("models");

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "models", label: "Phone Models", icon: Smartphone },
    { key: "compat", label: "Compatibility", icon: Link2 },
    { key: "brands", label: "Brands", icon: Package },
    { key: "parts", label: "Part Types", icon: Layers },
  ];

  return (
    <Card className="p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "models" && <ModelsCrud />}
      {tab === "compat" && <CompatibilityCrud />}
      {tab === "brands" && <BrandsCrud />}
      {tab === "parts" && <PartTypesCrud />}
    </Card>
  );
}

// ─── Phone Models CRUD ──────────────────────────────────────────────────
function ModelsCrud() {
  const qc = useQueryClient();
  const models = useQuery({ queryKey: ["admin-models"], queryFn: () => api.get<any[]>("/models") });
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => api.get<any[]>("/brands") });
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [year, setYear] = useState("");

  const openNew = () => { setEditing(null); setName(""); setBrandId(""); setYear(""); setOpen(true); };
  const openEdit = (m: any) => { setEditing(m); setName(m.name); setBrandId(m.brandId ?? ""); setYear(String(m.releaseYear ?? "")); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (editing) return api.put(`/models/${editing.id}`, { name, brandId, releaseYear: year ? Number(year) : null });
      return api.post("/models", { name, brandId, releaseYear: year ? Number(year) : null });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-models"] }); qc.invalidateQueries({ queryKey: ["models"] }); toast.success(editing ? "Model updated" : "Model created"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/models/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-models"] }); toast.success("Model deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{models.data?.length ?? 0} phone models</p>
        <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-4 w-4" /> Add Model</Button>
      </div>
      <div className="max-h-96 space-y-1.5 overflow-y-auto">
        {(models.data ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2.5">
            <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.brand?.name ?? "—"} · {m._count?.products ?? 0} parts</p>
            </div>
            <button onClick={() => openEdit(m)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={() => { if (confirm(`Delete ${m.name}?`)) del.mutate(m.id); }} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Model" : "Add Phone Model"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="mb-1.5 block text-xs">Model Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Samsung Galaxy A12" /></div>
            <div><Label className="mb-1.5 block text-xs">Brand</Label>
              <Select value={brandId} onValueChange={setBrandId}><SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger><SelectContent>{(brands.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="mb-1.5 block text-xs">Release Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2021" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!name || !brandId || save.isPending} onClick={() => save.mutate()}>{editing ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Compatibility CRUD ─────────────────────────────────────────────────
function CompatibilityCrud() {
  const qc = useQueryClient();
  const models = useQuery({ queryKey: ["admin-models"], queryFn: () => api.get<any[]>("/models") });
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [partType, setPartType] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const addLink = useMutation({
    mutationFn: async () => api.post("/compatibility", { modelId: modelA, peerId: modelB, partType }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compat-links"] }); toast.success("Compatibility added (both directions)"); setModelB(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch compatibility links for the searched model
  const links = useQuery({
    queryKey: ["compat-links", searchQ],
    queryFn: () => api.get<any>(`/compatibility?q=${encodeURIComponent(searchQ)}`),
    enabled: searchQ.length > 0,
  });

  const removeLink = useMutation({
    mutationFn: (linkId: string) => api.del(`/compatibility?id=${linkId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compat-links"] }); toast.success("Removed (both directions)"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Add new compatibility */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-3 text-sm font-semibold">Add Compatibility (bidirectional)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={modelA} onValueChange={setModelA}><SelectTrigger><SelectValue placeholder="Model A" /></SelectTrigger><SelectContent>{(models.data ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
          <Select value={modelB} onValueChange={setModelB}><SelectTrigger><SelectValue placeholder="Model B" /></SelectTrigger><SelectContent>{(models.data ?? []).filter((m) => m.id !== modelA).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
          <Select value={partType} onValueChange={setPartType}><SelectTrigger><SelectValue placeholder="Part type (all)" /></SelectTrigger><SelectContent><SelectItem value="">All parts</SelectItem>{["LCD", "OLED", "Touch Glass", "Battery", "Frame", "Charging Flex", "Power Flex", "Volume Flex", "Front Camera", "Camera", "Speaker", "Earpiece"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button className="mt-3 gap-1.5" disabled={!modelA || !modelB || addLink.isPending} onClick={() => addLink.mutate()}><Link2 className="h-4 w-4" /> Link Models</Button>
        <p className="mt-2 text-xs text-muted-foreground">Linking A↔B means searching either model shows the other as compatible. Removing removes both directions.</p>
      </div>

      {/* Search & manage existing */}
      <div>
        <Label className="mb-1.5 block text-xs">Search a model to view/edit its compatibility links</Label>
        <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="e.g. A12" />
      </div>

      {links.data?.peers && links.data.peers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{links.data.peers.length} compatible models for "{searchQ}":</p>
          {links.data.peers.map((p: any) => (
            <div key={p.id + p.partType} className="flex items-center gap-2 rounded-lg border p-2.5">
              <Link2 className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.brand ?? "—"} · {p.partType || "All parts"}</p>
              </div>
              {p.linkId && (
                <button onClick={() => removeLink.mutate(p.linkId)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {searchQ && links.data?.peers?.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">No compatibility links found for "{searchQ}".</p>
      )}
    </div>
  );
}

// ─── Brands CRUD ────────────────────────────────────────────────────────
function BrandsCrud() {
  const qc = useQueryClient();
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => api.get<any[]>("/brands") });
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");

  const add = useMutation({
    mutationFn: () => api.post("/brands", { name, country }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); qc.invalidateQueries({ queryKey: ["brands"] }); toast.success("Brand added"); setName(""); setCountry(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/brands/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-brands"] }); toast.success("Brand deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" />
        <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" />
        <Button className="gap-1.5" disabled={!name || add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {(brands.data ?? []).map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border p-2.5">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.country ?? "—"} · {b._count?.products ?? 0} parts</p>
            </div>
            <button onClick={() => { if (confirm(`Delete ${b.name}?`)) del.mutate(b.id); }} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Part Types CRUD ────────────────────────────────────────────────────
function PartTypesCrud() {
  const qc = useQueryClient();
  const partTypes = useQuery({ queryKey: ["admin-part-types"], queryFn: () => api.get<any[]>("/part-types") });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Misc");

  const add = useMutation({
    mutationFn: () => api.post("/part-types", { name, category }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-part-types"] }); qc.invalidateQueries({ queryKey: ["part-types"] }); toast.success("Part type added"); setName(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/part-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-part-types"] }); toast.success("Part type deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const categories = ["Display", "Power", "Housing", "Flex", "Camera", "Audio", "Board", "Button", "Misc"];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Part type name (e.g. LCD)" />
        <Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Button className="gap-1.5" disabled={!name || add.isPending} onClick={() => add.mutate()}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {(partTypes.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.category} · {p._count?.products ?? 0} products</p>
            </div>
            <button onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
