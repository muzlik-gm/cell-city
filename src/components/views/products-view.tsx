"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { QualityBadge } from "@/components/shared/badges";
import { ProductDetailSheet } from "@/components/shared/product-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Wallet,
  AlertTriangle,
  LayoutGrid,
  Search,
  X,
  Eye,
  ShoppingCart,
  ArrowDownUp,
  Smartphone,
  Monitor,
  BatteryMedium,
  Cable,
  Camera,
  Volume2,
  Cpu,
  MousePointerClick,
  Boxes,
  PackageSearch,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { motion } from "framer-motion";
import type { PartCategory } from "@/lib/types";

// ─── Category visual config ───────────────────────────────────────────────────
const CATEGORY_META: Record<
  PartCategory,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  Display: { icon: Monitor, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Display" },
  Power: { icon: BatteryMedium, color: "bg-teal-500/10 text-teal-600 dark:text-teal-400", label: "Power" },
  Housing: { icon: Smartphone, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", label: "Housing" },
  Flex: { icon: Cable, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: "Flex" },
  Camera: { icon: Camera, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", label: "Camera" },
  Audio: { icon: Volume2, color: "bg-sky-500/10 text-sky-600 dark:text-sky-400", label: "Audio" },
  Board: { icon: Cpu, color: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400", label: "Board" },
  Button: { icon: MousePointerClick, color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", label: "Button" },
  Misc: { icon: Boxes, color: "bg-muted text-muted-foreground", label: "Misc" },
};

const CATEGORY_ORDER: PartCategory[] = [
  "Display", "Power", "Housing", "Flex", "Camera", "Audio", "Board", "Button", "Misc",
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A–Z)" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "stock-desc", label: "Most Stock" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Brand { id: string; name: string; }
interface PartType { id: string; name: string; category: string; }
interface Product {
  id: string;
  sku: string;
  name: string;
  quality: string;
  condition: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  sellingPrice: number;
  color?: string | null;
  partTypeId?: string;
  brand?: { name: string };
  model?: { name: string };
  partType?: { name: string; category?: string };
  supplier?: { name: string };
  warehouse?: { name: string };
  shelf?: { code: string };
  images?: { url: string }[];
}

interface ProductsResp {
  data: Product[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── View ─────────────────────────────────────────────────────────────────────
export function ProductsView() {
  const { setView, setContextId } = useAppStore();
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState("");
  const [category, setCategory] = useState<PartCategory | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [detail, setDetail] = useState<Product | null>(null);

  // Fetch brands + partTypes (for category mapping)
  const brands = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () => api.get<Brand[]>("/brands"),
    staleTime: 60_000,
  });
  const partTypes = useQuery<PartType[]>({
    queryKey: ["part-types"],
    queryFn: () => api.get<PartType[]>("/part-types"),
    staleTime: 60_000,
  });

  // Build partTypeId → category lookup
  const partTypeCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const pt of partTypes.data ?? []) map.set(pt.id, pt.category);
    return map;
  }, [partTypes.data]);

  // Build query string
  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (brandId) p.set("brandId", brandId);
    p.set("page", "1");
    p.set("pageSize", "100");
    return p.toString();
  }, [q, brandId]);

  const products = useQuery<ProductsResp>({
    queryKey: ["products", queryStr],
    queryFn: () => api.get<ProductsResp>(`/products?${queryStr}`),
    staleTime: 30_000,
  });

  // Augment products with category (from partType lookup) and filter/sort client-side
  const enriched = useMemo(() => {
    return (products.data?.data ?? []).map((p) => ({
      ...p,
      _category: (p.partType?.category ?? partTypeCategory.get(p.partTypeId ?? "") ?? "Misc") as PartCategory,
    }));
  }, [products.data, partTypeCategory]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (category !== "ALL") list = list.filter((p) => p._category === category);
    const sorted = [...list];
    switch (sort) {
      case "name": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "price-asc": sorted.sort((a, b) => a.sellingPrice - b.sellingPrice); break;
      case "price-desc": sorted.sort((a, b) => b.sellingPrice - a.sellingPrice); break;
      case "stock-desc": sorted.sort((a, b) => b.stock - a.stock); break;
      case "newest":
      default:
        // newest first — assume API returns newest first already
        break;
    }
    return sorted;
  }, [enriched, category, sort]);

  // Stats (computed across the full unfiltered list when possible)
  const stats = useMemo(() => {
    const list = enriched;
    const totalProducts = products.data?.total ?? list.length;
    const stockValue = list.reduce((sum, p) => sum + p.sellingPrice * p.stock, 0);
    const outOfStock = list.filter((p) => p.stock <= 0).length;
    const cats = new Set(list.map((p) => p._category));
    return { totalProducts, stockValue, outOfStock, categories: cats.size };
  }, [enriched, products.data]);

  const hasFilters = q || brandId || category !== "ALL";
  const clearFilters = () => { setQ(""); setBrandId(""); setCategory("ALL"); };

  const onAddToSale = (p: Product) => {
    setContextId(p.id);
    setView("sales");
    toast.success(`"${p.name}" ready to add in Sales`, { description: "Open the New Sale dialog to complete the transaction." });
  };

  if (products.isError) {
    return <ErrorState message={products.error.message} onRetry={() => products.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Browse your parts catalog by category"
        icon={LayoutGrid}
        actions={
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-[180px] gap-1.5">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          icon={Package}
          accent="emerald"
          subtitle="across the catalog"
        />
        <StatCard
          label="Stock Value"
          value={formatCurrency(stats.stockValue)}
          icon={Wallet}
          accent="teal"
          subtitle="retail value"
        />
        <StatCard
          label="Out of Stock"
          value={stats.outOfStock}
          icon={AlertTriangle}
          accent="rose"
          subtitle="needs reorder"
        />
        <StatCard
          label="Categories"
          value={stats.categories}
          icon={LayoutGrid}
          accent="purple"
          subtitle="part categories"
        />
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-soft">
        <div className="space-y-3">
          {/* Search + brand */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, SKU, model, brand…"
                className="pl-9"
              />
            </div>
            <Select value={brandId} onValueChange={(v) => setBrandId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {(brands.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryChip
              active={category === "ALL"}
              onClick={() => setCategory("ALL")}
              icon={LayoutGrid}
              label="All"
              count={enriched.length}
            />
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = enriched.filter((p) => p._category === cat).length;
              if (count === 0 && category !== cat) return null;
              return (
                <CategoryChip
                  key={cat}
                  active={category === cat}
                  onClick={() => setCategory(cat)}
                  icon={meta.icon}
                  label={meta.label}
                  count={count}
                  color={meta.color}
                />
              );
            })}
          </div>
        </div>
      </Card>

      {/* Result count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> product{filtered.length !== 1 ? "s" : ""}
          {stats.totalProducts > enriched.length && (
            <span className="ml-1 text-xs">· of {stats.totalProducts} total</span>
          )}
        </p>
      </div>

      {/* Card grid */}
      {products.isLoading ? (
        <ProductGridSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={PackageSearch}
            title="No products match"
            description={hasFilters ? "Try adjusting your filters or search term." : "Add products to your inventory to see them here."}
            action={hasFilters ? <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5"><X className="h-4 w-4" /> Clear filters</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {filtered.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              index={i}
              onView={() => setDetail(p)}
              onAddToSale={() => onAddToSale(p)}
            />
          ))}
        </div>
      )}

      <ProductDetailSheet
        product={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onEdit={() => {
          setDetail(null);
          setView("inventory");
          toast.info("Editing products is available in Inventory");
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CategoryChip({
  active, onClick, icon: Icon, label, count, color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? color
            ? cn(color, "ring-1 ring-current/20")
            : "bg-primary text-primary-foreground shadow-soft"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className={cn("ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", active ? "bg-card/40" : "bg-background/60")}>
        {count}
      </span>
    </button>
  );
}

function ProductCard({
  product: p, index, onView, onAddToSale,
}: {
  product: Product & { _category?: PartCategory };
  index: number;
  onView: () => void;
  onAddToSale: () => void;
}) {
  const cat = (p._category ?? "Misc") as PartCategory;
  const meta = CATEGORY_META[cat] ?? CATEGORY_META.Misc;
  const Icon = meta.icon;
  const hasImage = !!p.images?.[0]?.url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.015, 0.2) }}
    >
      <Card
        onClick={onView}
        className="group relative cursor-pointer overflow-hidden p-0 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
      >
        {/* Image / placeholder */}
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {hasImage ? (
            <img
              src={p.images![0].url}
              alt={p.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1", meta.color)}>
              <Icon className="h-10 w-10" />
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{meta.label}</span>
            </div>
          )}
          {/* Hover overlay actions */}
          <div className="absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t from-black/70 via-black/0 to-transparent p-3 opacity-0 transition duration-200 group-hover:opacity-100">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5"
              onClick={(e) => { e.stopPropagation(); onView(); }}
            >
              <Eye className="h-3.5 w-3.5" /> View
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={(e) => { e.stopPropagation(); onAddToSale(); }}
              disabled={p.stock <= 0}
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Add to Sale
            </Button>
          </div>
          {/* Top-left category badge */}
          <div className="absolute left-2 top-2">
            <Badge variant="outline" className={cn("border-0 backdrop-blur-sm", meta.color)}>
              <Icon className="mr-1 h-3 w-3" />{meta.label}
            </Badge>
          </div>
          {/* Top-right stock badge */}
          <div className="absolute right-2 top-2">
            <div className="rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
              {p.stock > 0 ? `${p.stock} pcs` : "Out"}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-2 p-3">
          <div>
            <p className="line-clamp-1 text-sm font-semibold leading-tight">{p.name}</p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
              {p.brand?.name ?? "—"} · {p.model?.name ?? "—"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <QualityBadge quality={p.quality} />
            {p.partType?.name && (
              <Badge variant="secondary" className="text-[10px]">{p.partType.name}</Badge>
            )}
          </div>

          <div className="flex items-end justify-between gap-2 border-t pt-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Price</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.sellingPrice)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Shelf</p>
              <p className="text-xs font-medium">{p.shelf?.code ?? "—"}</p>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="overflow-hidden p-0">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-10" />
            </div>
            <div className="flex justify-between border-t pt-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-10" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
