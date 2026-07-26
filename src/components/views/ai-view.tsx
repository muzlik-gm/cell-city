"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { QualityBadge, StockBadge } from "@/components/shared/badges";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { formatCurrency, timeAgo, cn } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanFace,
  Cpu,
  Smartphone,
  Cable,
  Sparkles,
  Upload,
  Image as ImageIcon,
  X,
  Camera,
  CheckCircle2,
  ChevronRight,
  ShoppingCart,
  History,
  Loader2,
  Zap,
  Target,
  Puzzle,
  Package,
  Wand2,
  AlertTriangle,
  ArrowRight,
  Info,
  RefreshCw,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Mode = "phone" | "lcd";

interface VlmFeatures {
  cameraLayout?: string;
  buttonPlacement?: string;
  color?: string;
  material?: string;
  notch?: string;
}
interface VlmPossible {
  model: string;
  confidence: number;
}
interface VlmResult {
  detectedModel?: string;
  brand?: string;
  model?: string;
  detectedType?: string;
  connectorType?: string;
  flexDescription?: string;
  frameType?: string;
  size?: string;
  confidence?: number;
  features?: VlmFeatures;
  possibleModels?: VlmPossible[];
  possibleBrands?: string[];
  notes?: string;
  _raw?: string;
}

interface MatchedModel {
  id: string;
  name: string;
  slug: string;
  brand?: { id: string; name: string } | null;
  releaseYear?: number | null;
  imageUrl?: string | null;
  notes?: string | null;
}
interface CompatibleModel {
  id: string;
  name: string;
  brand?: string | null;
  partType: string;
  linkId: string;
}
interface AvailableProduct {
  id: string;
  sku: string;
  name: string;
  quality: string;
  condition: string;
  stock: number;
  minStock: number;
  sellingPrice: number;
  purchasePrice: number;
  color?: string | null;
  lcdCode?: string | null;
  connectorType?: string | null;
  brand?: { name: string } | null;
  model?: { name: string } | null;
  partType?: { name: string; category?: string } | null;
  warehouse?: { name: string } | null;
  shelf?: { code: string } | null;
  images?: { url: string }[];
}

interface IdentifyResponse {
  imageUrl: string;
  mode: Mode;
  vlmResult: VlmResult;
  vlmRaw: string | null;
  vlmError: string | null;
  matchedModels: MatchedModel[];
  compatibleModels: CompatibleModel[];
  availableProducts: AvailableProduct[];
  keywords: { brands: string[]; models: string[] };
}

interface HistoryItem {
  id: string;
  imageUrl: string;
  mode: Mode;
  detectedLabel: string;
  confidence: number;
  matchedCount: number;
  productCount: number;
  at: string;
  response: IdentifyResponse;
}

// ─── View ───────────────────────────────────────────────────────────────────
export function AiView() {
  const { setView, setContextId } = useAppStore();
  const [mode, setMode] = useState<Mode>("phone");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  // ─── Mutation: call /api/ai/identify ──────────────────────────────────────
  const identifyMut = useMutation({
    mutationFn: async (vars: { file: File; mode: Mode }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      fd.append("mode", vars.mode);
      const res = await fetch("/api/ai/identify", { method: "POST", body: fd });
      if (!res.ok) {
        let msg = `Identification failed (${res.status})`;
        try {
          const b = await res.json();
          msg = b.error || msg;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      return (await res.json()) as IdentifyResponse;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (data) => {
      setResult(data);
      const detected =
        data.mode === "phone"
          ? data.vlmResult.detectedModel ?? "Unknown model"
          : data.vlmResult.detectedType ?? "Unknown type";
      const conf = typeof data.vlmResult.confidence === "number" ? data.vlmResult.confidence : 0;
      setHistory((h) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            imageUrl: data.imageUrl,
            mode: data.mode,
            detectedLabel: detected,
            confidence: conf,
            matchedCount: data.matchedModels.length,
            productCount: data.availableProducts.length,
            at: new Date().toISOString(),
            response: data,
          },
          ...h,
        ].slice(0, 8),
      );
      toast.success("Identification complete", {
        description: data.vlmError
          ? "AI returned partial results — see notes."
          : `${detected} · ${conf}% confidence`,
      });
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error("Identification failed", { description: e.message });
    },
  });

  const isAnalyzing = identifyMut.isPending;

  // ─── File handling ────────────────────────────────────────────────────────
  const onPickFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error("Image too large (max 8MB)");
        return;
      }
      pendingFileRef.current = file;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setImageUrl(null);
      setResult(null);
      setError(null);
    },
    [previewUrl],
  );

  const onAnalyze = useCallback(() => {
    const file = pendingFileRef.current;
    if (!file) {
      toast.error("Upload an image first");
      return;
    }
    identifyMut.mutate({ file, mode });
  }, [identifyMut, mode]);

  const onReset = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    pendingFileRef.current = null;
    setImageUrl(null);
    setResult(null);
    setError(null);
  }, [previewUrl]);

  const onHistoryClick = useCallback((h: HistoryItem) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    pendingFileRef.current = null;
    setImageUrl(h.imageUrl);
    setResult(h.response);
    setMode(h.mode);
    setError(null);
  }, [previewUrl]);

  const onAddToSale = useCallback(
    (p: AvailableProduct) => {
      setContextId(p.id);
      setView("sales");
      toast.success(`"${p.name}" ready to add in Sales`, {
        description: "Open the New Sale dialog to complete the transaction.",
      });
    },
    [setContextId, setView],
  );

  const hasResult = !!result;
  const confidence = typeof result?.vlmResult?.confidence === "number" ? result.vlmResult.confidence : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Identification"
        description="Identify phone models & LCD parts from photos"
        icon={ScanFace}
        actions={
          hasResult ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onReset}>
              <RefreshCw className="h-3.5 w-3.5" /> New Scan
            </Button>
          ) : null
        }
      />

      {/* Mode selector cards */}
      <ModeSelector mode={mode} onChange={(m) => { setMode(m); onReset(); }} disabled={isAnalyzing} />

      {/* Upload zone OR Results */}
      <AnimatePresence mode="wait">
        {!hasResult && !isAnalyzing && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <UploadZone
              mode={mode}
              previewUrl={previewUrl}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onPickFile={onPickFile}
              onAnalyze={onAnalyze}
              onReset={onReset}
              fileInputRef={fileInputRef}
              hasPreview={!!previewUrl}
            />
          </motion.div>
        )}

        {isAnalyzing && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnalyzingState mode={mode} previewUrl={previewUrl ?? imageUrl} />
          </motion.div>
        )}

        {hasResult && !isAnalyzing && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ResultsLayout
              result={result!}
              mode={mode}
              confidence={confidence}
              onAddToSale={onAddToSale}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast / banner */}
      {error && !isAnalyzing && (
        <Card className="border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Identification failed</p>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        </Card>
      )}

      {/* History strip */}
      {history.length > 0 && (
        <Card className="p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Recent Identifications</h3>
            <Badge variant="secondary" className="ml-1 text-[10px]">{history.length}</Badge>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => onHistoryClick(h)}
                className="group flex w-44 shrink-0 flex-col gap-2 rounded-lg border bg-card p-2 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                  <img src={h.imageUrl} alt={h.detectedLabel} className="h-full w-full object-cover" />
                  <div className="absolute right-1 top-1">
                    <ModePill mode={h.mode} compact />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-semibold">{h.detectedLabel}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{h.confidence}%</span>
                    <span>·</span>
                    <span>{h.matchedCount} models</span>
                    <span>·</span>
                    <span>{h.productCount} parts</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">{timeAgo(h.at)}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Empty-state tips when nothing has happened yet */}
      {!hasResult && !isAnalyzing && !previewUrl && (
        <EmptyState
          icon={Wand2}
          title="Snap a photo, let AI identify it"
          description="Upload a phone back panel or an LCD/flex close-up. Our vision model returns its best guess, then we cross-reference your live inventory for matching parts."
        />
      )}
    </div>
  );
}

// ─── Mode selector ───────────────────────────────────────────────────────────
function ModeSelector({
  mode, onChange, disabled,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ModeCard
        active={mode === "phone"}
        onClick={() => !disabled && onChange("phone")}
        disabled={disabled}
        icon={Smartphone}
        title="Identify Phone"
        subtitle="Back-panel photo"
        description="Camera layout, logo, buttons, color"
        accent="emerald"
      />
      <ModeCard
        active={mode === "lcd"}
        onClick={() => !disabled && onChange("lcd")}
        disabled={disabled}
        icon={Cable}
        title="Identify LCD"
        subtitle="Connector / flex photo"
        description="Connector pins, flex cable, frame type"
        accent="teal"
      />
    </div>
  );
}

function ModeCard({
  active, onClick, disabled, icon: Icon, title, subtitle, description, accent,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  description: string;
  accent: "emerald" | "teal";
}) {
  const accentBg = accent === "emerald"
    ? "from-emerald-500/15 via-emerald-500/5 to-transparent"
    : "from-teal-500/15 via-teal-500/5 to-transparent";
  const accentText = accent === "emerald"
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : "bg-teal-500/15 text-teal-600 dark:text-teal-400";
  const accentRing = accent === "emerald" ? "ring-emerald-500/40" : "ring-teal-500/40";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-soft transition",
        "hover:-translate-y-0.5 hover:shadow-card",
        active ? cn("ring-2", accentRing) : "hover:border-primary/30",
        disabled && "cursor-not-allowed opacity-60 hover:translate-y-0",
      )}
    >
      {/* gradient sheen */}
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100", active && "opacity-100", accentBg)} />

      <div className="relative flex items-start gap-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", accentText)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold tracking-tight">{title}</h3>
            {active && (
              <motion.span layoutId="mode-active-dot" className="flex h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{subtitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", active && "translate-x-0.5 text-primary")} />
      </div>
    </button>
  );
}

function ModePill({ mode, compact }: { mode: Mode; compact?: boolean }) {
  const Icon = mode === "phone" ? Smartphone : Cable;
  const label = mode === "phone" ? "Phone" : "LCD";
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 backdrop-blur-sm",
        mode === "phone"
          ? "bg-emerald-500/80 text-white"
          : "bg-teal-500/80 text-white",
        compact ? "gap-1 px-1.5 py-0 text-[10px]" : "gap-1",
      )}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {!compact && label}
    </Badge>
  );
}

// ─── Upload zone ─────────────────────────────────────────────────────────────
function UploadZone({
  mode, previewUrl, dragOver, setDragOver, onPickFile, onAnalyze, onReset, fileInputRef, hasPreview,
}: {
  mode: Mode;
  previewUrl: string | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onPickFile: (f: File) => void;
  onAnalyze: () => void;
  onReset: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  hasPreview: boolean;
}) {
  return (
    <Card className="overflow-hidden p-0 shadow-card">
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        {/* Drop area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) onPickFile(f);
          }}
          className={cn(
            "relative flex min-h-[360px] flex-col items-center justify-center gap-4 p-8 transition",
            dragOver ? "bg-primary/5" : "bg-muted/20",
            hasPreview && "p-4",
          )}
        >
          {previewUrl ? (
            <div className="relative h-full w-full">
              <div className="relative mx-auto aspect-square max-h-[360px] w-full max-w-[360px] overflow-hidden rounded-xl border bg-background shadow-soft">
                <img src={previewUrl} alt="upload preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onReset(); }}
                  className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white backdrop-blur hover:bg-rose-500/80"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute left-2 top-2">
                  <ModePill mode={mode} />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Ready to analyze · click "Analyze Image" on the right
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-4 text-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className={cn(
                    "flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed",
                    dragOver
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/30 bg-background text-primary shadow-soft",
                  )}
                >
                  <Upload className="h-8 w-8" />
                </motion.div>
                <div>
                  <p className="text-base font-semibold">
                    {mode === "phone" ? "Drop phone back photo here" : "Drop LCD / connector photo here"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    or <span className="font-medium text-primary">click to browse</span>
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground/70">
                    JPG · PNG · WebP · max 8 MB
                  </p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>

        {/* Side panel: tips + action */}
        <div className="border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {mode === "phone" ? "How to get the best result" : "Tips for LCD identification"}
                </h3>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {mode === "phone" ? (
                  <>
                    <Tip icon={Camera}>Use a clear photo of the back panel</Tip>
                    <Tip icon={Target}>Show the camera module & brand logo</Tip>
                    <Tip icon={Info}>Good lighting, avoid glare</Tip>
                    <Tip icon={Cpu}>Include buttons if possible</Tip>
                  </>
                ) : (
                  <>
                    <Tip icon={Cable}>Photo the connector close-up</Tip>
                    <Tip icon={Target}>Show pin count & layout</Tip>
                    <Tip icon={Info}>Include the flex cable if present</Tip>
                    <Tip icon={Cpu}>Mark any IC codes visible</Tip>
                  </>
                )}
              </ul>
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              disabled={!hasPreview}
              onClick={onAnalyze}
            >
              <Zap className="h-4 w-4" />
              Analyze Image
            </Button>

            {hasPreview && (
              <Button variant="ghost" className="w-full gap-1.5" size="sm" onClick={onReset}>
                <X className="h-3.5 w-3.5" /> Remove image
              </Button>
            )}

            <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
              <p className="flex items-start gap-1.5">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  Powered by GLM-4.6V vision model. Results are AI predictions — always verify with the actual part before sale.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Tip({
  icon: Icon, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3 w-3" />
      </span>
      <span>{children}</span>
    </li>
  );
}

// ─── Analyzing state with scan-line animation ────────────────────────────────
function AnalyzingState({ mode, previewUrl }: { mode: Mode; previewUrl: string | null }) {
  return (
    <Card className="overflow-hidden p-0 shadow-card">
      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="relative flex min-h-[360px] items-center justify-center bg-muted/30 p-4">
          {previewUrl ? (
            <div className="relative aspect-square w-full max-w-[360px] overflow-hidden rounded-xl border bg-background">
              <img src={previewUrl} alt="analyzing" className="h-full w-full object-cover" />

              {/* Scanning overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/10" />

              {/* Moving scan line */}
              <motion.div
                className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_4px_rgba(16,185,129,0.6)]"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 bg-primary/40 blur-sm" />
              </motion.div>

              {/* Corner brackets */}
              <ScanCorners />

              {/* Top label */}
              <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-[10px] font-medium backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                Analyzing…
              </div>
              <div className="absolute right-2 top-2">
                <ModePill mode={mode} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm">Processing image…</p>
            </div>
          )}
        </div>

        <div className="border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary"
                >
                  <Cpu className="h-4 w-4" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold">AI Vision Analysis</p>
                  <p className="text-xs text-muted-foreground">Cross-referencing inventory…</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <ScanStep label="Uploading image" delay={0} />
              <ScanStep label={mode === "phone" ? "Detecting phone model" : "Detecting LCD type"} delay={0.5} />
              <ScanStep label="Matching catalog models" delay={1.0} />
              <ScanStep label="Finding compatible parts" delay={1.5} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ScanStep({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex items-center gap-2 text-xs"
    >
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity, delay }}
        className="flex h-4 w-4 items-center justify-center"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      </motion.span>
      <span className="text-muted-foreground">{label}</span>
    </motion.div>
  );
}

function ScanCorners() {
  const cornerCls = "absolute h-6 w-6 border-primary";
  return (
    <>
      <div className={cn(cornerCls, "left-2 top-2 border-l-2 border-t-2 rounded-tl-md")} />
      <div className={cn(cornerCls, "right-2 top-2 border-r-2 border-t-2 rounded-tr-md")} />
      <div className={cn(cornerCls, "bottom-2 left-2 border-b-2 border-l-2 rounded-bl-md")} />
      <div className={cn(cornerCls, "bottom-2 right-2 border-b-2 border-r-2 rounded-br-md")} />
    </>
  );
}

// ─── Results layout ──────────────────────────────────────────────────────────
function ResultsLayout({
  result, mode, confidence, onAddToSale,
}: {
  result: IdentifyResponse;
  mode: Mode;
  confidence: number;
  onAddToSale: (p: AvailableProduct) => void;
}) {
  const vlm = result.vlmResult;
  const isPhone = mode === "phone";
  const detectedLabel = isPhone
    ? vlm.detectedModel ?? "Unknown model"
    : vlm.detectedType ?? "Unknown type";

  return (
    <div className="space-y-4">
      {/* Top row: image + analysis */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* Uploaded image */}
        <Card className="overflow-hidden p-0 shadow-soft">
          <div className="relative aspect-square w-full bg-muted">
            <img src={result.imageUrl} alt="analyzed" className="h-full w-full object-cover" />
            <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-emerald-500/90 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
              <CheckCircle2 className="h-3 w-3" /> Analyzed
            </div>
            <div className="absolute right-2 top-2">
              <ModePill mode={mode} />
            </div>
          </div>
        </Card>

        {/* AI analysis card */}
        <Card className="p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                AI Analysis
              </div>
              <h3 className="mt-1 line-clamp-2 text-xl font-bold tracking-tight">
                {detectedLabel}
              </h3>
              {isPhone && vlm.brand && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Brand: <span className="font-medium text-foreground">{vlm.brand}</span>
                  {vlm.model && <> · Model: <span className="font-medium text-foreground">{vlm.model}</span></>}
                </p>
              )}
              {!isPhone && vlm.frameType && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Frame: <span className="font-medium text-foreground">{vlm.frameType}</span>
                  {vlm.size && <> · Size: <span className="font-medium text-foreground">{vlm.size}</span></>}
                </p>
              )}
            </div>
            <ConfidenceGauge value={confidence} />
          </div>

          {/* VLM error banner */}
          {result.vlmError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="text-amber-700 dark:text-amber-300">
                Vision model issue: {result.vlmError}. Showing best-effort results.
              </span>
            </div>
          )}

          {/* Detected features grid */}
          {isPhone && vlm.features && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {vlm.features.cameraLayout && (
                <FeatureItem icon={Camera} label="Camera Layout" value={vlm.features.cameraLayout} />
              )}
              {vlm.features.buttonPlacement && (
                <FeatureItem icon={Cpu} label="Buttons" value={vlm.features.buttonPlacement} />
              )}
              {vlm.features.color && (
                <FeatureItem icon={Target} label="Color" value={vlm.features.color} />
              )}
              {vlm.features.material && (
                <FeatureItem icon={Info} label="Material" value={vlm.features.material} />
              )}
              {vlm.features.notch && (
                <FeatureItem icon={Smartphone} label="Notch / Punch-hole" value={vlm.features.notch} />
              )}
            </div>
          )}

          {!isPhone && (vlm.connectorType || vlm.flexDescription) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {vlm.connectorType && (
                <FeatureItem icon={Cable} label="Connector" value={vlm.connectorType} />
              )}
              {vlm.flexDescription && (
                <FeatureItem icon={Cpu} label="Flex Cable" value={vlm.flexDescription} />
              )}
              {vlm.frameType && (
                <FeatureItem icon={Smartphone} label="Frame" value={vlm.frameType} />
              )}
              {vlm.size && (
                <FeatureItem icon={Target} label="Size" value={vlm.size} />
              )}
            </div>
          )}

          {/* Notes */}
          {vlm.notes && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">AI Notes</p>
              <p className="text-sm">{vlm.notes}</p>
            </div>
          )}

          {/* Possible matches */}
          {isPhone && Array.isArray(vlm.possibleModels) && vlm.possibleModels.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Possible Alternatives
              </p>
              <div className="space-y-2">
                {vlm.possibleModels.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <p className="w-48 shrink-0 truncate text-sm font-medium">{m.model}</p>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, m.confidence))}%` }}
                        transition={{ duration: 0.7, delay: i * 0.1 }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {m.confidence}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isPhone && Array.isArray(vlm.possibleBrands) && vlm.possibleBrands.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Possible Brands
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vlm.possibleBrands.map((b, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill
          icon={Target}
          label="Matched in Catalog"
          value={result.matchedModels.length}
          accent="emerald"
        />
        <StatPill
          icon={Puzzle}
          label="Compatible Models"
          value={result.compatibleModels.length}
          accent="teal"
        />
        <StatPill
          icon={Package}
          label="Available Products"
          value={result.availableProducts.length}
          accent="purple"
        />
      </div>

      {/* Matched models in DB */}
      <Card className="p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold">Matched Models in Catalog</h3>
            <Badge variant="secondary" className="text-[10px]">{result.matchedModels.length}</Badge>
          </div>
          {result.keywords.brands.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Keywords: {result.keywords.brands.join(", ")} · {result.keywords.models.join(", ") || "—"}
            </p>
          )}
        </div>
        {result.matchedModels.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No catalog matches"
            description="The AI didn't find a corresponding model in your inventory. Try a clearer photo or add the model in Inventory."
            className="py-8"
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {result.matchedModels.map((m) => (
              <ModelChip key={m.id} model={m} />
            ))}
          </div>
        )}
      </Card>

      {/* Compatible models */}
      {result.compatibleModels.length > 0 && (
        <Card className="p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-semibold">Compatible Models</h3>
            <Badge variant="secondary" className="text-[10px]">{result.compatibleModels.length}</Badge>
            <span className="text-xs text-muted-foreground">· shared parts from compatibility engine</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.compatibleModels.slice(0, 30).map((c) => (
              <Badge
                key={c.linkId}
                variant="outline"
                className="gap-1.5 bg-teal-500/5 py-1.5 text-xs"
              >
                <Smartphone className="h-3 w-3 text-teal-500" />
                <span className="font-medium">{c.brand ? `${c.brand} ` : ""}{c.name}</span>
                {c.partType && (
                  <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    {c.partType}
                  </span>
                )}
              </Badge>
            ))}
            {result.compatibleModels.length > 30 && (
              <Badge variant="outline" className="bg-muted py-1.5 text-xs">
                +{result.compatibleModels.length - 30} more
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Available products */}
      <Card className="overflow-hidden p-0 shadow-soft">
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold">Available Products</h3>
            <Badge variant="secondary" className="text-[10px]">{result.availableProducts.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">In-stock parts for detected model</p>
        </div>
        {result.availableProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No matching products in stock"
            description="Add inventory for the detected model, or check compatibility with similar models."
            className="py-10"
          />
        ) : (
          <ScrollArea className="max-h-[560px]">
            <ProductTable products={result.availableProducts} onAddToSale={onAddToSale} />
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}

// ─── Sub-components for results ──────────────────────────────────────────────
function ConfidenceGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;
  const color = v >= 75 ? "#10b981" : v >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>{v}</span>
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">conf%</span>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 text-primary" />
        {label}
      </div>
      <p className="mt-1 text-xs leading-snug">{value}</p>
    </div>
  );
}

function StatPill({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "emerald" | "teal" | "purple";
}) {
  const accentMap = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  return (
    <Card className="flex items-center gap-3 p-4 shadow-soft">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", accentMap[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function ModelChip({ model }: { model: MatchedModel }) {
  return (
    <Badge variant="outline" className="gap-1.5 bg-emerald-500/5 py-1.5 pl-2 pr-3 text-xs">
      <Smartphone className="h-3 w-3 text-emerald-500" />
      <span className="font-medium">{model.brand?.name ?? "—"} {model.name}</span>
      {model.releaseYear && (
        <span className="text-[10px] text-muted-foreground">{model.releaseYear}</span>
      )}
    </Badge>
  );
}

function ProductTable({
  products, onAddToSale,
}: {
  products: AvailableProduct[];
  onAddToSale: (p: AvailableProduct) => void;
}) {
  return (
    <div className="w-full">
      {/* Mobile card layout */}
      <div className="grid gap-2 p-3 sm:hidden">
        {products.map((p) => (
          <div key={p.id} className="rounded-lg border bg-card p-3 shadow-soft">
            <div className="flex items-start gap-3">
              <Thumb product={p} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">
                  {p.brand?.name ?? "—"} · {p.model?.name ?? "—"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <QualityBadge quality={p.quality} />
                  {p.partType?.name && (
                    <Badge variant="secondary" className="text-[10px]">{p.partType.name}</Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(p.sellingPrice)}
                    </span>
                    <StockBadge stock={p.stock} minStock={p.minStock} />
                  </div>
                  <Button
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={p.stock <= 0}
                    onClick={() => onAddToSale(p)}
                  >
                    <ShoppingCart className="h-3 w-3" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table layout */}
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Product</th>
            <th className="px-4 py-2.5 font-semibold">Part Type</th>
            <th className="px-4 py-2.5 font-semibold">Quality</th>
            <th className="px-4 py-2.5 text-center font-semibold">Stock</th>
            <th className="px-4 py-2.5 font-semibold">Shelf</th>
            <th className="px-4 py-2.5 text-right font-semibold">Price</th>
            <th className="px-4 py-2.5 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Thumb product={p} small />
                  <div className="min-w-0">
                    <p className="line-clamp-1 font-medium">{p.name}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      {p.brand?.name ?? "—"} · {p.model?.name ?? "—"} · {p.color ?? "—"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5">
                {p.partType?.name ? (
                  <Badge variant="secondary" className="text-[10px]">{p.partType.name}</Badge>
                ) : "—"}
              </td>
              <td className="px-4 py-2.5"><QualityBadge quality={p.quality} /></td>
              <td className="px-4 py-2.5 text-center">
                <StockBadge stock={p.stock} minStock={p.minStock} />
              </td>
              <td className="px-4 py-2.5 text-xs font-medium">{p.shelf?.code ?? "—"}</td>
              <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(p.sellingPrice)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button
                  size="sm"
                  variant={p.stock > 0 ? "default" : "outline"}
                  className="h-7 gap-1 px-2.5 text-xs"
                  disabled={p.stock <= 0}
                  onClick={() => onAddToSale(p)}
                >
                  <ShoppingCart className="h-3 w-3" /> Add to Sale
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Thumb({ product, small }: { product: AvailableProduct; small?: boolean }) {
  const url = product.images?.[0]?.url;
  const sizeCls = small ? "h-10 w-10" : "h-14 w-14";
  if (url) {
    return (
      <div className={cn("shrink-0 overflow-hidden rounded-md border bg-muted", sizeCls)}>
        <img src={url} alt={product.name} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground", sizeCls)}>
      <Package className={small ? "h-4 w-4" : "h-5 w-5"} />
    </div>
  );
}
