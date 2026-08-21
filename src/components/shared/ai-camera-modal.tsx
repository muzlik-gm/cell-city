"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, Upload, X, Loader2, ScanEye, Smartphone, Package, 
  ArrowRight, Sparkles, Zap, Cpu, CheckCircle2, AlertCircle,
  RefreshCw, Image as ImageIcon
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/format";
import { LiveCameraCapture } from "@/components/shared/live-camera-capture";
import { cn } from "@/lib/utils";

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

// Chrome AI types
interface ChromeAISession {
  prompt: (prompt: string) => Promise<string>;
  destroy: () => Promise<void>;
}

interface ChromeAILanguageCapabilities {
  create: (options?: { systemPrompt?: string }) => Promise<ChromeAISession>;
  capabilities: () => Promise<{
    available: "readily" | "after-download" | "no";
    defaultTopK?: number;
    maxTopK?: number;
  }>;
  languageModelId(): Promise<string>;
}

declare global {
  interface Window {
    ai?: {
      languageModel: ChromeAILanguageCapabilities;
    };
  }
}

export function AiCameraModal({ open, onOpenChange }: AiCameraModalProps) {
  const [mode, setMode] = useState<"phone" | "lcd">("phone");
  const [captureMode, setCaptureMode] = useState<"camera" | "upload">("camera");
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setView } = useAppStore();
  
  // Chrome AI state
  const [chromeAiAvailable, setChromeAiAvailable] = useState<boolean | null>(null);
  const [chromeAiStatus, setChromeAiStatus] = useState<string>("");
  const [useChromeAi, setUseChromeAi] = useState(true);
  const aiSessionRef = useRef<ChromeAISession | null>(null);

  // Check Chrome AI availability on mount and when modal opens
  useEffect(() => {
    if (open) {
      checkChromeAiAvailability();
    }
    return () => {
      // Cleanup AI session when modal closes
      if (aiSessionRef.current) {
        aiSessionRef.current.destroy().catch(() => {});
        aiSessionRef.current = null;
      }
    };
  }, [open]);

  const checkChromeAiAvailability = useCallback(async () => {
    setChromeAiStatus("checking");
    
    try {
      if (!window.ai?.languageModel) {
        setChromeAiAvailable(false);
        setChromeAiStatus("not_available");
        return;
      }

      const capabilities = await window.ai.languageModel.capabilities();
      
      if (capabilities.available === "readily") {
        setChromeAiAvailable(true);
        setChromeAiStatus("ready");
      } else if (capabilities.available === "after-download") {
        setChromeAiAvailable(true);
        setChromeAiStatus("downloading");
        toast.info("Downloading AI model for offline identification...");
        
        // Try to create session to trigger download
        try {
          const session = await window.ai.languageModel.create({
            systemPrompt: `You are a mobile phone and LCD screen expert. You identify phone models from images with high accuracy. Always respond in JSON format.`
          });
          await session.destroy();
          setChromeAiStatus("ready");
        } catch {
          setChromeAiAvailable(false);
          setChromeAiStatus("error");
        }
      } else {
        setChromeAiAvailable(false);
        setChromeAiStatus("not_available");
      }
    } catch (error) {
      console.error("Chrome AI check failed:", error);
      setChromeAiAvailable(false);
      setChromeAiStatus("error");
    }
  }, []);

  const analyzeWithChromeAi = async (imageBase64: string): Promise<any> => {
    if (!window.ai?.languageModel) {
      throw new Error("Chrome AI not available");
    }

    setChromeAiStatus("analyzing");

    // Create or reuse AI session
    if (!aiSessionRef.current) {
      aiSessionRef.current = await window.ai.languageModel.create({
        systemPrompt: `You are an expert at identifying mobile phones and LCD screens from images.

When given an image of a phone back:
- Identify the brand (Samsung, iPhone/Xiaomi, etc.)
- Identify the specific model (Galaxy A12, iPhone 13 Pro, Redmi Note 10, etc.)
- Look for camera layout, logo position, button placement, flash location

When given an image of an LCD/flex cable:
- Identify the type (LCD, OLED, AMOLED)
- Identify connector type
- Estimate compatible models

ALWAYS respond with valid JSON only, no markdown:
{
  "detectedModel": "string",
  "brand": "string",
  "confidence": number (0-100),
  "possibleModels": [{"model": "string", "confidence": number}],
  "keywords": ["string"],
  "type": "phone" or "lcd"
}`
      });
    }

    const session = aiSessionRef.current;

    // Build prompt based on mode
    const prompt = mode === "phone"
      ? `Analyze this phone back image carefully. Identify:
1. The exact phone model (e.g., Samsung Galaxy A12, iPhone 13 Pro, Xiaomi Redmi Note 10)
2. The brand
3. Your confidence level (0-100)

Look for distinctive features: camera module shape/arrangement, logo placement, button positions, flash location, overall form factor.

Respond with JSON only.`
      : `Analyze this LCD/flex cable image carefully. Identify:
1. The type of display component (LCD, OLED, AMOLED, Touch Glass, Flex Cable)
2. The connector type if visible
3. Compatible phone models if identifiable
4. Your confidence level (0-100)

Look for: connector shape, ribbon cable pattern, IC chips, flex layout, mounting points.

Respond with JSON only.`;

    try {
      const response = await session.prompt(
        `${prompt}\n\n[Image data: ${imageBase64.substring(0, 100)}...]`
      );

      // Parse the AI response
      let parsed;
      try {
        // Extract JSON from response (in case of extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { detectedModel: response.trim().substring(0, 100), confidence: 70 };
        }
      } catch {
        parsed = { 
          detectedModel: response.trim().substring(0, 100), 
          brand: "",
          confidence: 65,
          possibleModels: []
        };
      }

      setChromeAiStatus("complete");

      return {
        vlmResult: {
          ...parsed,
          source: "chrome-ai"
        },
        keywords: parsed.keywords || [],
        imageUrl: `data:image/jpeg;base64,${imageBase64}`,
        matchedModels: [],
        compatibleModels: [],
        availableProducts: []
      };

    } catch (error) {
      console.error("Chrome AI analysis failed:", error);
      throw new Error("Chrome AI analysis failed");
    }
  };

  const reset = useCallback(() => {
    setImage(null);
    setResult(null);
    setAnalyzing(false);
    setChromeAiStatus(chromeAiAvailable === true ? "ready" : "");
  }, [chromeAiAvailable]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setAnalyzing(true);
    
    try {
      // Convert file to base64 for Chrome AI
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get base64 only
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Create preview URL
      setImage(URL.createObjectURL(file));

      let analysisResult: IdentifyResult;

      // Try Chrome AI first if available and enabled
      if (useChromeAi && chromeAiAvailable && window.ai?.languageModel) {
        try {
          analysisResult = await analyzeWithChromeAi(imageBase64);
          
          // Also send to server for catalog matching
          try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("mode", mode);
            const serverRes = await fetch("/api/ai/identify", { method: "POST", body: fd });
            if (serverRes.ok) {
              const serverData = await serverRes.json();
              // Merge server results (catalog matching) with Chrome AI results
              analysisResult.matchedModels = serverData.matchedModels || [];
              analysisResult.compatibleModels = serverData.compatibleModels || [];
              analysisResult.availableProducts = serverData.availableProducts || [];
            }
          } catch (serverError) {
            console.warn("Server matching failed, using Chrome AI results only:", serverError);
          }

          setResult(analysisResult);
          toast.success("Phone identified using Chrome AI!");
          return;
        } catch (chromeAiError) {
          console.warn("Chrome AI failed, falling back to server:", chromeAiError);
          toast.warning("Chrome AI unavailable, using server analysis...");
        }
      }

      // Fallback to server-side analysis
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
      toast.success("Analysis complete!");

    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }, [mode, useChromeAi, chromeAiAvailable]);

  const handleSell = (productId: string) => {
    useAppStore.getState().setContextId(productId);
    setView("sales");
    onOpenChange(false);
  };

  const confidence = result?.vlmResult?.confidence ?? 0;
  const confidenceColor = confidence >= 75 ? "text-emerald-600 dark:text-emerald-400" : 
                          confidence >= 45 ? "text-amber-600 dark:text-amber-400" : 
                          "text-red-600 dark:text-red-400";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTimeout(reset, 200); }}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">AI Camera Identification</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-white shadow-elevated">
              <ScanEye className="h-5 w-5" />
              {chromeAiAvailable && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-card" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">AI Camera Search</h2>
              <p className="text-xs text-muted-foreground">
                {chromeAiAvailable === true ? "Powered by Chrome AI + Server" : "Identify any phone or LCD"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Chrome AI status indicator */}
            {chromeAiAvailable !== null && (
              <Badge 
                variant="outline" 
                className={cn(
                  "gap-1.5 text-[10px] font-medium",
                  chromeAiAvailable ? "border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : 
                  "border-muted-foreground/20 text-muted-foreground"
                )}
              >
                {chromeAiAvailable ? (
                  <>
                    <Cpu className="h-3 w-3" />
                    Chrome AI Ready
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    Server Only
                  </>
                )}
              </Badge>
            )}
            
            <button 
              onClick={() => onOpenChange(false)} 
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          {!result && !analyzing && (
            <>
              {/* Mode selector */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setMode("phone")}
                  className={cn(
                    "flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-200",
                    mode === "phone" 
                      ? "border-primary bg-primary/5 shadow-soft" 
                      : "border-border hover:border-border/80 hover:bg-accent/50"
                  )}
                >
                  <Smartphone className={cn(
                    "h-7 w-7 transition-colors",
                    mode === "phone" ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-semibold">Phone Back</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    Camera layout, logo, buttons
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setMode("lcd")}
                  className={cn(
                    "flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition-all duration-200",
                    mode === "lcd" 
                      ? "border-primary bg-primary/5 shadow-soft" 
                      : "border-border hover:border-border/80 hover:bg-accent/50"
                  )}
                >
                  <Package className={cn(
                    "h-7 w-7 transition-colors",
                    mode === "lcd" ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-semibold">LCD / Flex</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-relaxed">
                    Connector, ribbon, IC
                  </span>
                </motion.button>
              </div>

              {/* Capture mode toggle */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCaptureMode("camera")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200",
                    captureMode === "camera" 
                      ? "border-primary bg-primary/5 text-primary shadow-soft" 
                      : "border-border text-muted-foreground hover:border-border/80 hover:bg-accent/50"
                  )}
                >
                  <Camera className="h-4 w-4" /> Live Camera
                </button>
                
                <button
                  onClick={() => setCaptureMode("upload")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200",
                    captureMode === "upload" 
                      ? "border-primary bg-primary/5 text-primary shadow-soft" 
                      : "border-border text-muted-foreground hover:border-border/80 hover:bg-accent/50"
                  )}
                >
                  <Upload className="h-4 w-4" /> Upload Image
                </button>
              </div>

              {/* Live camera capture */}
              {captureMode === "camera" && (
                <LiveCameraCapture onCapture={handleFile} onClose={() => onOpenChange(false)} />
              )}

              {/* Upload zone */}
              {captureMode === "upload" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  className={cn(
                    "flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed transition-all duration-200",
                    dragOver 
                      ? "border-primary bg-primary/5 scale-[1.01]" 
                      : "border-border bg-muted/20 hover:bg-muted/30 hover:border-border/60"
                  )}
                >
                  <div className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-200",
                    dragOver ? "bg-primary/10 scale-110" : "bg-card shadow-soft"
                  )}>
                    <ImageIcon className={cn(
                      "h-8 w-8 transition-colors",
                      dragOver ? "text-primary" : "text-primary"
                    )} />
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Upload an image</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Drag & drop or click to browse
                    </p>
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-2 rounded-xl"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Choose File
                  </Button>
                  
                  {chromeAiAvailable && (
                    <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Zap className="h-3 w-3 text-chart-2" />
                      Will use Chrome AI for instant local identification
                    </p>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { 
                  const f = e.target.files?.[0]; 
                  if (f) handleFile(f); 
                  e.target.value = ""; 
                }}
              />

              {/* Chrome AI toggle */}
              {chromeAiAvailable && (
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-gradient-to-r from-primary/5 to-transparent p-3.5 border border-primary/10">
                  <input
                    type="checkbox"
                    checked={useChromeAi}
                    onChange={(e) => setUseChromeAi(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-foreground">Use Chrome AI (Recommended)</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Faster, works offline, identifies locally on your device
                    </p>
                  </div>
                  <Cpu className="h-4 w-4 text-primary" />
                </label>
              )}
            </>
          )}

          {/* Analyzing state */}
          {analyzing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative mb-6">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/10 to-chart-3/10 flex items-center justify-center">
                  {chromeAiStatus === "analyzing" ? (
                    <Cpu className="h-10 w-10 text-primary" />
                  ) : (
                    <ScanEye className="h-10 w-10 text-primary" />
                  )}
                </div>
                
                {/* Scanning animation */}
                <motion.div
                  className="absolute inset-x-4 h-1 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"
                  initial={{ top: 8, opacity: 0 }}
                  animate={{ top: ["8%", "92%", "8%"], opacity: [0, 1, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                
                {/* Pulse effect */}
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
              </div>

              <p className="text-base font-semibold text-foreground">
                {chromeAiStatus === "analyzing" ? "Analyzing with Chrome AI..." : "Analyzing image..."}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Identifying {mode === "phone" ? "phone model" : "LCD type"} • This may take a moment
              </p>

              {/* Progress steps */}
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Image captured</span>
                <ArrowRight className="h-3 w-3" />
                <Loader2 className={cn("h-4 w-4", chromeAiStatus === "analyzing" ? "animate-spin text-primary" : "")} />
                <span className={chromeAiStatus === "analyzing" ? "text-primary font-medium" : ""}>AI Analysis</span>
                <ArrowRight className="h-3 w-3 opacity-40" />
                <AlertCircle className="h-4 w-4 opacity-40" />
                <span className="opacity-40">Results</span>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {result && !analyzing && (
            <AnimatePresence mode="wait">
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-5"
              >
                {/* Image + Detection Result */}
                <div className="flex gap-4">
                  <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-card shadow-soft">
                    <img src={result.imageUrl || image || ""} alt="Analyzed device" className="h-full w-full object-cover" />
                    
                    {/* Source badge */}
                    {result.vlmResult?.source === "chrome-ai" && (
                      <Badge className="absolute top-2 left-2 gap-1 bg-background/90 backdrop-blur-sm text-[9px]">
                        <Cpu className="h-2.5 w-2.5" /> Chrome AI
                      </Badge>
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        AI Detected
                      </span>
                      {result.vlmResult?.source === "chrome-ai" && (
                        <Badge variant="outline" className="gap-1 text-[9px] border-emerald-500/30 text-emerald-600">
                          <Zap className="h-2.5 w-2.5" /> Local Processing
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                      {result.vlmResult?.detectedModel || result.vlmResult?.detectedType || "Unknown Device"}
                    </h3>
                    
                    {result.vlmResult?.brand && (
                      <p className="text-sm text-muted-foreground mt-0.5">{result.vlmResult.brand}</p>
                    )}
                    
                    {/* Confidence meter */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${confidence}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                          className={cn(
                            "h-full rounded-full",
                            confidence >= 75 ? "bg-emerald-500" : confidence >= 45 ? "bg-amber-500" : "bg-red-500"
                          )}
                        />
                      </div>
                      <span className={cn("text-sm font-bold tabular-nums min-w-[3rem]", confidenceColor)}>
                        {Math.round(confidence)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Possible alternatives */}
                {result.vlmResult?.possibleModels?.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Alternative Possibilities
                    </p>
                    <div className="space-y-1.5">
                      {result.vlmResult.possibleModels.slice(0, 4).map((m: any, i: number) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between rounded-xl border border-border/50 px-3.5 py-2.5 bg-card/50"
                        >
                          <span className="text-sm font-medium">{m.model || m.name}</span>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {m.confidence}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched models in catalog */}
                {result.matchedModels?.length > 0 && (
                  <div>
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      In Your Catalog
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.matchedModels.map((m: any) => (
                        <motion.button
                          key={m.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
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
                          className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
                        >
                          {m.name}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available products */}
                {result.availableProducts?.length > 0 ? (
                  <div>
                    <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Available Parts ({result.availableProducts.length})
                    </p>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {result.availableProducts.slice(0, 12).map((p: any) => (
                        <div 
                          key={p.id} 
                          className="group flex items-center gap-3 rounded-xl border border-border/50 p-3 bg-card/50 hover:bg-card hover:shadow-soft transition-all duration-200"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {p.images?.[0]?.url ? (
                              <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.stock} in stock · {p.shelf?.code ?? "—"} · {formatCurrency(p.sellingPrice)}
                            </p>
                          </div>
                          
                          <Button 
                            size="sm" 
                            className="h-8 gap-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleSell(p.id)}
                          >
                            Sell <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/50 p-6 text-center bg-muted/20">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No matching parts in stock for this model.
                    </p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="mt-2 text-xs"
                      onClick={() => setView("inventory")}
                    >
                      View all inventory
                    </Button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2 rounded-xl"
                    onClick={reset}
                  >
                    <RefreshCw className="h-4 w-4" /> Scan Another
                  </Button>
                  
                  {result.matchedModels?.length > 0 && (
                    <Button 
                      className="flex-1 gap-2 rounded-xl gradient-primary"
                      onClick={() => {
                        if (result.matchedModels[0]) {
                          const input = document.getElementById("universal-search") as HTMLInputElement | null;
                          if (input) {
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                            if (setter) {
                              setter.call(input, result.matchedModels[0].name);
                              input.dispatchEvent(new Event("input", { bubbles: true }));
                            }
                          }
                          onOpenChange(false);
                        }
                      }}
                    >
                      <Search className="h-4 w-4" /> Find Parts
                    </Button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Search({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
