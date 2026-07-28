"use client";

import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, X, Loader2, ScanEye, Smartphone, Package, ArrowRight, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/format";

interface AiCameraModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface IdentifyResult {
  imageUrl: string;
  mode: string;
  vlmResult: any;
  matchedModels: any[];
  compatibleModels: any[];
  availableProducts: any[];
  keywords: string[];
}

export function AiCameraModal({ open, onOpenChange }: AiCameraModalProps) {
  const [mode, setMode] = useState<"phone" | "lcd">("phone");
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { setView } = useAppStore();

  const reset = useCallback(() => {
    setImage(null);
    setResult(null);
    setAnalyzing(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/ai/identify", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Analysis failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }, [mode]);

  const handleSell = (productId: string) => {
    useAppStore.getState().setContextId(productId);
    setView("sales");
    onOpenChange(false);
  };

  const confidence = result?.vlmResult?.confidence ?? 0;
  const confidenceColor = confidence >= 75 ? "text-emerald-600" : confidence >= 45 ? "text-amber-600" : "text-rose-600";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogTitle className="sr-only">AI Camera Identification</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-emerald text-white">
              <ScanEye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">AI Camera Search</h2>
              <p className="text-xs text-muted-foreground">Identify any phone or LCD from a photo</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {!result && !analyzing && (
            <>
              {/* Mode selector */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("phone")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${
                    mode === "phone" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <Smartphone className={`h-6 w-6 ${mode === "phone" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Phone Back</span>
                  <span className="text-[10px] text-muted-foreground">Camera layout, logo, buttons</span>
                </button>
                <button
                  onClick={() => setMode("lcd")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${
                    mode === "lcd" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <Package className={`h-6 w-6 ${mode === "lcd" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">LCD / Flex</span>
                  <span className="text-[10px] text-muted-foreground">Connector, ribbon, IC</span>
                </button>
              </div>

              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                className={`flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition ${
                  dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-soft">
                  <Camera className="h-7 w-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Take a photo or upload an image</p>
                  <p className="text-xs text-muted-foreground">Drag & drop or click below</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" className="gap-1.5" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Camera
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Upload
                  </Button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </>
          )}

          {/* Analyzing state */}
          {analyzing && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-primary/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanEye className="h-8 w-8 text-primary" />
                </div>
                <motion.div
                  className="absolute inset-x-0 h-0.5 bg-primary"
                  initial={{ top: 0 }}
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <p className="mt-4 text-sm font-medium">Analyzing image…</p>
              <p className="text-xs text-muted-foreground">Identifying {mode === "phone" ? "phone model" : "LCD type"}</p>
            </div>
          )}

          {/* Results */}
          {result && !analyzing && (
            <div className="space-y-4">
              {/* Image + detected */}
              <div className="flex gap-4">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border bg-muted">
                  <img src={result.imageUrl} alt="analyzed" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">AI detected</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold">
                    {result.vlmResult?.detectedModel || result.vlmResult?.detectedType || "Unknown"}
                  </h3>
                  {result.vlmResult?.brand && (
                    <p className="text-sm text-muted-foreground">{result.vlmResult.brand}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${confidence >= 75 ? "bg-emerald-500" : confidence >= 45 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${confidenceColor}`}>{confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Possible alternatives */}
              {result.vlmResult?.possibleModels?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Possible alternatives</p>
                  <div className="space-y-1.5">
                    {result.vlmResult.possibleModels.slice(0, 4).map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-1.5">
                        <span className="text-sm font-medium">{m.model || m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched models in catalog — click to view all compatible parts */}
              {result.matchedModels?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In your catalog</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedModels.map((m: any) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          // Pipe the detected model into the home universal search
                          const input = document.getElementById("universal-search") as HTMLInputElement | null;
                          if (input) {
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                            if (setter) {
                              setter.call(input, m.name);
                              input.dispatchEvent(new Event("input", { bubbles: true }));
                            }
                          }
                          onOpenChange(false);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/20"
                      >
                        {m.name}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Available products */}
              {result.availableProducts?.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Available parts ({result.availableProducts.length})
                  </p>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {result.availableProducts.slice(0, 12).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {p.images?.[0]?.url ? (
                            <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.stock} in stock · {p.shelf?.code ?? "—"} · {formatCurrency(p.sellingPrice)}
                          </p>
                        </div>
                        <Button size="sm" className="h-7 gap-1" onClick={() => handleSell(p.id)}>
                          Sell <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">No matching parts in stock for this model.</p>
                </div>
              )}

              {/* Start over */}
              <Button variant="outline" className="w-full gap-1.5" onClick={reset}>
                <Camera className="h-4 w-4" /> Scan another
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
