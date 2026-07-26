"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { QualityBadge, StockBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Puzzle,
  Monitor,
  Hand,
  BatteryMedium,
  Smartphone,
  Cable,
  Layers,
  Plus,
  Trash2,
  X,
  Package,
  Sparkles,
  ArrowRight,
  Boxes,
  ChevronRight,
  Link2,
  Filter,
  CircleDot,
} from "lucide-react";

// ─── Part-type visual config ──────────────────────────────────────────────────
type PartKind = "LCD" | "TOUCH" | "BATTERY" | "FRAME" | "FLEX" | "ALL";

const PART_KINDS: {
  key: PartKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  ring: string;
  dot: string;
}[] = [
  { key: "LCD", label: "LCD", icon: Monitor, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "ring-amber-500/30", dot: "bg-amber-500" },
  { key: "TOUCH", label: "Touch", icon: Hand, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", ring: "ring-purple-500/30", dot: "bg-purple-500" },
  { key: "BATTERY", label: "Battery", icon: BatteryMedium, color: "bg-teal-500/10 text-teal-600 dark:text-teal-400", ring: "ring-teal-500/30", dot: "bg-teal-500" },
  { key: "FRAME", label: "Frame", icon: Smartphone, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", ring: "ring-rose-500/30", dot: "bg-rose-500" },
  { key: "FLEX", label: "Flex", icon: Cable, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30", dot: "bg-emerald-500" },
  { key: "ALL", label: "All Parts", icon: Layers, color: "bg-muted text-muted-foreground", ring: "ring-border", dot: "bg-muted-foreground" },
];

const partKindMeta = (key: string) =>
  PART_KINDS.find((p) => p.key === key) ?? PART_KINDS.find((p) => p.key === "ALL")!;

// ─── Types ────────────────────────────────────────────────────────────────────
interface PhoneModel {
  id: string;
  name: string;
  brand?: { name: string };
  releaseYear?: number | null;
}

interface Peer {
  id: string;
  name: string;
  brand?: string;
  partType: string;
  linkId: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  quality: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  sellingPrice: number;
  brand?: { name: string };
  model?: { name: string; id: string };
  partType?: { name: string; category?: string };
  supplier?: { name: string };
  warehouse?: { name: string };
  shelf?: { code: string };
  images?: { url: string }[];
}

interface CompatResult {
  models: PhoneModel[];
  peers: Peer[];
  products: Product[];
}

// Knowledge queries: pre-filled searches that demonstrate the engine's power
const KNOWLEDGE_QUERIES = [
  { label: "Which phones use this LCD?", q: "LCD", icon: Monitor, hint: "Type a phone name to see LCD-sharing peers" },
  { label: "Which LCD fits this phone?", q: "A12", icon: Search, hint: "Find interchangeable LCDs for the A12 family" },
  { label: "Which batteries are compatible?", q: "iPhone 11", icon: BatteryMedium, hint: "Cross-compatible batteries for iPhone 11 line" },
  { label: "Find frames & housings", q: "Redmi Note 8", icon: Smartphone, hint: "Housings shared across Redmi Note 8 series" },
  { label: "Flex cable substitutes", q: "Oppo A5", icon: Cable, hint: "Flex ribbons compatible with Oppo A5/A5s" },
  { label: "Touch glass alternatives", q: "Vivo Y", icon: Hand, hint: "Touch digitizers shared across Vivo Y series" },
];

// ─── View ─────────────────────────────────────────────────────────────────────
export function CompatibilityView() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [activePart, setActivePart] = useState<PartKind | "ANY">("ANY");
  const [manageOpen, setManageOpen] = useState(false);

  // Debounce search input → query
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(input.trim());
      setActivePart("ANY");
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const result = useQuery<CompatResult>({
    queryKey: ["compat", query],
    queryFn: () => api.get<CompatResult>(`/compatibility?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
    staleTime: 30_000,
  });

  // Group peers by partType
  const peersByPart = useMemo(() => {
    const map = new Map<string, Peer[]>();
    for (const p of result.data?.peers ?? []) {
      const key = p.partType || "ALL";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [result.data]);

  // Group products by partType name (the PartType.name like "LCD", "OLED")
  const productsByPart = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of result.data?.products ?? []) {
      const key = p.partType?.name ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [result.data]);

  // Available part-type chips from current results
  const availablePartTypes = useMemo(() => {
    const set = new Set<string>();
    for (const p of result.data?.products ?? []) set.add(p.partType?.name ?? "Other");
    return Array.from(set).sort();
  }, [result.data]);

  const filteredProducts = useMemo(() => {
    if (activePart === "ANY") return result.data?.products ?? [];
    // Filter by partType.name match for product display
    return (result.data?.products ?? []).filter((p) => {
      const name = (p.partType?.name ?? "").toUpperCase();
      if (activePart === "ALL") return true;
      // Match LCD/TOUCH/BATTERY/FRAME/FLEX loosely
      return name.includes(activePart);
    });
  }, [result.data, activePart]);

  const hasQuery = query.length >= 1;
  const isLoading = result.isLoading && hasQuery;
  const isEmpty = hasQuery && !isLoading && (result.data?.models.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compatibility Engine"
        description="Find which phones share LCDs, touch, batteries, frames & flex"
        icon={Puzzle}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
            <Link2 className="h-4 w-4" /> Manage Links
          </Button>
        }
      />

      {/* Search */}
      <Card className="overflow-hidden p-0 shadow-card">
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search any phone model — e.g. 'A12', 'iPhone 11', 'Redmi Note 8'…"
            className="h-16 border-0 bg-transparent pl-14 pr-28 text-base shadow-none focus-visible:ring-0 sm:text-lg"
          />
          {input && (
            <button
              onClick={() => setInput("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Instant knowledge lookup · bidirectional compatibility · live inventory</span>
        </div>
      </Card>

      {/* Knowledge queries (always visible when no results) */}
      <AnimatePresence mode="wait">
        {!hasQuery && (
          <motion.div
            key="knowledge"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Knowledge Queries
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {KNOWLEDGE_QUERIES.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setInput(q.q)}
                    className="group flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-soft transition hover:border-primary/40 hover:shadow-card"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/15">
                      <q.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{q.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{q.hint}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>

            {/* Hero empty state */}
            <Card className="relative overflow-hidden border-dashed bg-gradient-to-br from-primary/5 via-card to-card p-8 text-center shadow-soft">
              <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Boxes className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-bold">Start typing to discover compatible parts</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  The Compatibility Engine instantly cross-references phone models — showing you every
                  interchangeable LCD, touch, battery, frame, and flex cable in your inventory.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {PART_KINDS.filter((p) => p.key !== "ALL").map((p) => (
                    <Badge key={p.key} variant="outline" className={cn("gap-1.5 py-1.5", p.color)}>
                      <p.icon className="h-3.5 w-3.5" /> {p.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && <CompatSkeleton />}

      {/* Error */}
      {result.isError && hasQuery && (
        <ErrorState message={result.error.message} onRetry={() => result.refetch()} />
      )}

      {/* No matches */}
      {isEmpty && (
        <Card className="p-0">
          <EmptyState
            icon={Search}
            title="No matching models found"
            description={`No phone models contain "${query}". Try a different name like "A12", "iPhone", or "Redmi".`}
            action={
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
                <Plus className="h-4 w-4" /> Add Compatibility Link
              </Button>
            }
          />
        </Card>
      )}

      {/* Results */}
      {hasQuery && !isLoading && !result.isError && (result.data?.models.length ?? 0) > 0 && (
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Matched models */}
          <section>
            <SectionHeader icon={Smartphone} title="Matched Models" count={result.data?.models.length ?? 0} />
            <div className="flex flex-wrap gap-2">
              {result.data?.models.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group flex items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 shadow-soft transition hover:border-primary/40 hover:shadow-card"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.brand?.name ?? "—"}{m.releaseYear ? ` · ${m.releaseYear}` : ""}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Compatible peers grouped by part type */}
          <section>
            <SectionHeader icon={Link2} title="Compatible Peers" count={result.data?.peers.length ?? 0} subtitle="Phones that share parts with the matched models" />
            {peersByPart.size === 0 ? (
              <Card className="p-0">
                <EmptyState
                  icon={Link2}
                  title="No compatibility links yet"
                  description="Add a link to mark which other models share parts with these phones."
                  action={
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setManageOpen(true)}>
                      <Plus className="h-4 w-4" /> Add Link
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {PART_KINDS.filter((p) => p.key !== "ALL").map((pk) => {
                  const peers = peersByPart.get(pk.key) ?? [];
                  if (peers.length === 0) return null;
                  const Icon = pk.icon;
                  return (
                    <Card key={pk.key} className="overflow-hidden p-0 shadow-soft">
                      <div className={cn("flex items-center justify-between px-4 py-3", pk.color)}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-semibold">{pk.label}</span>
                        </div>
                        <Badge variant="outline" className="border-current/20 bg-card/40 text-foreground">
                          {peers.length}
                        </Badge>
                      </div>
                      <ScrollArea className="max-h-56">
                        <div className="space-y-1 p-2.5">
                          {peers.map((p) => (
                            <button
                              key={p.linkId}
                              onClick={() => setInput(p.name)}
                              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-muted"
                            >
                              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", pk.dot)} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground">{p.brand ?? "—"}</p>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Available products */}
          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionHeader
                icon={Package}
                title="Available Products"
                count={result.data?.products.length ?? 0}
                subtitle="Inventory available across matched & peer models"
                noMargin
              />
            </div>

            {/* Part-type filter chips */}
            {availablePartTypes.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  onClick={() => setActivePart("ANY")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    activePart === "ANY"
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  )}
                >
                  All ({result.data?.products.length ?? 0})
                </button>
                {availablePartTypes.map((pt) => {
                  const count = productsByPart.get(pt)?.length ?? 0;
                  const upper = pt.toUpperCase();
                  const pk = PART_KINDS.find((p) => upper.includes(p.key)) ?? PART_KINDS.find((p) => p.key === "ALL")!;
                  const active = activePart === pk.key || (activePart === "ANY" && false);
                  return (
                    <button
                      key={pt}
                      onClick={() => setActivePart(pk.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                        active
                          ? cn(pk.color, "ring-1", pk.ring)
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      <pk.icon className="h-3 w-3" />
                      {pt} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <Card className="p-0">
                <EmptyState icon={Package} title="No products in stock" description="No inventory found for these compatible models." />
              </Card>
            ) : (
              <CompatProductsTable products={filteredProducts} />
            )}
          </section>
        </motion.div>
      )}

      {/* Manage dialog */}
      <ManageCompatDialog open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, title, subtitle, count, noMargin,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  count?: number;
  noMargin?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", !noMargin && "mb-3")}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight sm:text-base">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {count !== undefined && (
        <Badge variant="secondary" className="font-semibold">{count}</Badge>
      )}
    </div>
  );
}

function CompatProductsTable({ products }: { products: Product[] }) {
  return (
    <Card className="overflow-hidden p-0 shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Product</th>
              <th className="px-3 py-3">Part Type</th>
              <th className="px-3 py-3">Quality</th>
              <th className="px-3 py-3">Stock</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3">Supplier</th>
              <th className="px-3 py-3 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.id} className={cn("border-b transition hover:bg-muted/30", i % 2 === 1 && "bg-muted/10")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {p.images?.[0]?.url ? (
                        <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.brand?.name ?? "—"} · {p.model?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge variant="secondary" className="text-xs">{p.partType?.name ?? "—"}</Badge>
                </td>
                <td className="px-3 py-3"><QualityBadge quality={p.quality} /></td>
                <td className="px-3 py-3"><StockBadge stock={p.stock} minStock={p.minStock} /></td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{p.shelf?.code ?? "—"}</p>
                  <p>{p.warehouse?.name ?? "—"}</p>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{p.supplier?.name ?? "—"}</td>
                <td className="px-3 py-3 text-right">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.sellingPrice)}</p>
                  <p className="text-[11px] text-muted-foreground">cost {formatCurrency(p.purchasePrice)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CompatSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-44 rounded-xl" />)}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Manage compatibility dialog ──────────────────────────────────────────────
function ManageCompatDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [modelId, setModelId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [partType, setPartType] = useState("LCD");
  const [note, setNote] = useState("");
  const [searchByModel, setSearchByModel] = useState("");

  // Load all models (for the two dropdowns)
  const models = useQuery<PhoneModel[]>({
    queryKey: ["models", "manage"],
    queryFn: () => api.get<PhoneModel[]>("/models"),
    enabled: open,
    staleTime: 60_000,
  });

  // Load compatibility links for the selected model (search by name)
  const selectedModel = models.data?.find((m) => m.id === modelId);
  const links = useQuery<CompatResult>({
    queryKey: ["compat", selectedModel?.name ?? ""],
    queryFn: () => api.get<CompatResult>(`/compatibility?q=${encodeURIComponent(selectedModel?.name ?? "")}`),
    enabled: open && !!selectedModel?.name,
    staleTime: 30_000,
  });

  // Filtered models for dropdown search
  const filteredModelList = useMemo(() => {
    const list = models.data ?? [];
    if (!searchByModel) return list;
    return list.filter((m) => m.name.toLowerCase().includes(searchByModel.toLowerCase()) || m.brand?.name?.toLowerCase().includes(searchByModel.toLowerCase()));
  }, [models.data, searchByModel]);

  const onAdd = async () => {
    if (!modelId || !peerId) {
      toast.error("Select both a model and a peer model");
      return;
    }
    if (modelId === peerId) {
      toast.error("A model cannot be linked to itself");
      return;
    }
    try {
      await api.post("/compatibility", { modelId, peerId, partType, note: note || null });
      toast.success("Compatibility link added");
      qc.invalidateQueries({ queryKey: ["compat"] });
      setPeerId("");
      setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (linkId: string, peerName: string, pt: string) => {
    try {
      await api.del(`/compatibility?id=${linkId}`);
      toast.success(`Removed ${pt} link with ${peerName}`);
      qc.invalidateQueries({ queryKey: ["compat"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const existingLinks = links.data?.peers ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Manage Compatibility Links
          </DialogTitle>
          <DialogDescription>
            Link two phone models that share a part type. Links are bidirectional — adding a link automatically makes both models compatible.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1fr]">
          {/* Add form */}
          <div className="space-y-4 border-b p-6 lg:border-b-0 lg:border-r">
            <h3 className="text-sm font-semibold">Add New Link</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={modelId} onValueChange={(v) => { setModelId(v); }}>
                <SelectTrigger><SelectValue placeholder="Select a phone model" /></SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search models…"
                      value={searchByModel}
                      onChange={(e) => setSearchByModel(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="max-h-60">
                    {filteredModelList.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} <span className="text-xs text-muted-foreground">· {m.brand?.name}</span>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Peer Model</Label>
              <Select value={peerId} onValueChange={setPeerId}>
                <SelectTrigger><SelectValue placeholder="Select a compatible model" /></SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-60">
                    {(models.data ?? [])
                      .filter((m) => m.id !== modelId)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} <span className="text-xs text-muted-foreground">· {m.brand?.name}</span>
                        </SelectItem>
                      ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Part Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {PART_KINDS.filter((p) => p.key !== "ALL").map((pk) => {
                  const active = partType === pk.key;
                  const Icon = pk.icon;
                  return (
                    <button
                      key={pk.key}
                      type="button"
                      onClick={() => setPartType(pk.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                        active ? cn(pk.color, "ring-1", pk.ring, "border-transparent") : "border-border hover:bg-muted"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {pk.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Same LCD manufacturer" />
            </div>

            <Button className="w-full gap-1.5" onClick={onAdd} disabled={!modelId || !peerId}>
              <Plus className="h-4 w-4" /> Add Link
            </Button>
          </div>

          {/* Existing links */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-sm font-semibold">Existing Links</h3>
              {selectedModel && (
                <Badge variant="outline" className="max-w-[200px] truncate">
                  {selectedModel.name}
                </Badge>
              )}
            </div>
            <ScrollArea className="max-h-[55vh]">
              {!selectedModel ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  <Smartphone className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Select a model to view its existing links.
                </div>
              ) : links.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : existingLinks.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  <Link2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No compatibility links for this model yet.
                </div>
              ) : (
                <div className="space-y-1.5 p-3">
                  {existingLinks.map((l) => {
                    const pk = partKindMeta(l.partType);
                    const Icon = pk.icon;
                    return (
                      <div
                        key={l.linkId}
                        className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition hover:border-primary/30"
                      >
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", pk.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {l.brand ?? "—"} · {pk.label}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(l.linkId, l.name, pk.label)}
                          aria-label={`Delete link with ${l.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
