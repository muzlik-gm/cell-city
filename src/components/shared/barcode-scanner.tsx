"use client";

// ────────────────────────────────────────────────────────────────────────────
// BarcodeScannerDialog
// A reusable camera-based QR/barcode scanner using the native
// `BarcodeDetector` API (Chrome / Edge / Android). Falls back to a clear
// "unsupported" message + manual-entry input when the API is unavailable.
// ────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ScanLine, Camera, CameraOff, AlertCircle, CheckCircle2, Keyboard,
  Loader2, RefreshCw, Volume2, VolumeX,
} from "lucide-react";

// TS shim — the BarcodeDetector API is not yet in lib.dom typings.
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

// Minimal type for our shim — the native BarcodeDetector exposes
// `getSupportedFormats()` (static) and `detect(source)` (instance).
interface DetectedBarcode {
  rawValue: string;
  boundingBox: DOMRectReadOnly;
  format: string;
}

type ScanError =
  | "unsupported"
  | "permission-denied"
  | "no-camera"
  | "in-use"
  | "unknown";

const ALL_FORMATS = [
  "qr_code", "ean_13", "ean_8", "code_128", "code_39", "code_93",
  "upc_a", "upc_e", "codabar", "itf", "data_matrix", "pdf417", "aztec",
];

// ────────────────────────────────────────────────────────────────────────────
// Small Web-Audio beep — no asset needed.
// ────────────────────────────────────────────────────────────────────────────
function playBeep(enabled: boolean) {
  if (!enabled) return;
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1080;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    /* ignore audio errors */
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Dialog
// ────────────────────────────────────────────────────────────────────────────
export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired whenever a code is detected or manually entered. */
  onDetected: (value: string) => void;
  /** When true, the dialog stays open after each detection (continuous mode). */
  continuous?: boolean;
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
  continuous = false,
}: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<{ value: string; at: number } | null>(null);

  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "error">("idle");
  const [error, setError] = useState<ScanError | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [continuousLocal, setContinuousLocal] = useState(continuous);
  const [lastFound, setLastFound] = useState<string | null>(null);

  // ── Support check: "adjust state during render" on first open ──────────
  // Avoids setState-in-effect. We compute synchronously from window.
  if (supported === null && open && typeof window !== "undefined") {
    setSupported("BarcodeDetector" in window && !!window.BarcodeDetector);
  }
  // Async-verify getSupportedFormats() — setState is inside .catch callback
  // (asynchronous), which is permitted by the lint rule.
  useEffect(() => {
    if (supported !== true) return;
    if (!window.BarcodeDetector?.getSupportedFormats) return;
    let cancelled = false;
    window.BarcodeDetector.getSupportedFormats()
      .catch(() => { if (!cancelled) setSupported(false); });
    return () => { cancelled = true; };
  }, [supported]);

  // ── Reset transient state when dialog closes — "adjust state during render" ─
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setStatus("idle");
      setLastFound(null);
    }
  }

  // ── Start camera + detection loop ───────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Clear debounce tracker so the next session starts fresh.
    lastCodeRef.current = null;
  }, []);

  const handleDetection = useCallback(
    (value: string) => {
      playBeep(soundOn);
      setLastFound(value);
      onDetected(value);
      if (!continuousLocal) {
        onOpenChange(false);
      }
    },
    [soundOn, continuousLocal, onDetected, onOpenChange],
  );

  // Always-current ref so the rAF loop never captures a stale handler
  // (sound/continuous toggles take effect without restarting the loop).
  const handleDetectionRef = useRef(handleDetection);
  useEffect(() => {
    handleDetectionRef.current = handleDetection;
  }, [handleDetection]);

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;
    if (!video || !canvas || !detector) return;

    const tick = async () => {
      if (!streamRef.current) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        // Match canvas size to the displayed video for performance.
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const codes: DetectedBarcode[] = await detector.detect(canvas);
            if (codes && codes.length > 0) {
              const value = codes[0].rawValue?.trim();
              if (value) {
                // Debounce: same code within 1.5s is ignored.
                const now = Date.now();
                const last = lastCodeRef.current;
                if (!last || last.value !== value || now - last.at > 1500) {
                  lastCodeRef.current = { value, at: now };
                  handleDetectionRef.current(value);
                }
              }
            }
          } catch {
            /* detection errors are non-fatal; keep looping */
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startCamera = useCallback(async () => {
    if (!supported) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("no-camera");
      setStatus("error");
      return;
    }
    setStatus("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {
        /* autoplay can throw on some browsers, but play() is user-gesture-triggered via dialog open */
      });

      // Build detector once.
      if (!detectorRef.current && window.BarcodeDetector) {
        try {
          detectorRef.current = new window.BarcodeDetector({
            formats: ALL_FORMATS,
          });
        } catch {
          detectorRef.current = new window.BarcodeDetector();
        }
      }
      setStatus("scanning");
      runDetectionLoop();
    } catch (e: unknown) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setError("permission-denied");
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        setError("no-camera");
      } else if (err?.name === "NotReadableError") {
        setError("in-use");
      } else {
        setError("unknown");
      }
      setStatus("error");
    }
  }, [supported, runDetectionLoop]);

  // ── Lifecycle: start when open + supported; stop camera on close/unmount ─
  useEffect(() => {
    if (open && supported === true) {
      // Defer to a microtask so setState inside startCamera happens outside
      // the synchronous effect body (avoids cascading renders).
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) startCamera();
      });
      return () => {
        cancelled = true;
        stopCamera();
      };
    }
    return () => stopCamera();
  }, [open, supported, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ── Manual entry submit ─────────────────────────────────────────────────
  const submitManual = () => {
    const v = manualValue.trim();
    if (!v) return;
    setManualValue("");
    handleDetection(v);
  };

  // ── Error message renderer ──────────────────────────────────────────────
  const renderError = () => {
    const map: Record<ScanError, { title: string; body: string; icon: typeof AlertCircle }> = {
      unsupported: {
        title: "Live scanning not supported",
        body: "Your browser doesn't support the native BarcodeDetector API. Use Chrome or Edge on desktop / Android — or type the code manually below.",
        icon: CameraOff,
      },
      "permission-denied": {
        title: "Camera permission denied",
        body: "Please allow camera access in your browser settings, then retry. The camera is only used while this dialog is open.",
        icon: AlertCircle,
      },
      "no-camera": {
        title: "No camera found",
        body: "We couldn't find a suitable camera on this device. Type the code manually below to continue.",
        icon: CameraOff,
      },
      "in-use": {
        title: "Camera is busy",
        body: "Another app is using the camera. Close it and retry — or type the code manually.",
        icon: AlertCircle,
      },
      unknown: {
        title: "Camera error",
        body: "Something went wrong starting the camera. Retry, or type the code manually.",
        icon: AlertCircle,
      },
    };
    const cfg = map[error ?? "unknown"];
    const Icon = cfg.icon;
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{cfg.title}</p>
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{cfg.body}</p>
        </div>
        {error !== "unsupported" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={startCamera}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry camera
          </Button>
        )}
      </div>
    );
  };

  // ── Live video preview + overlay ────────────────────────────────────────
  const renderVideo = () => (
    <div className="relative overflow-hidden rounded-xl border bg-black aspect-[4/3]">
      {/* Video element */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Hidden canvas used for detection */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Dark vignette + scanning frame */}
      <div className="pointer-events-none absolute inset-0">
        {/* Dim everything outside the scan window */}
        <div className="absolute inset-0 bg-black/35" />
        {/* Clear scan window (cut-out via 4 surrounding rectangles alternative) */}
        <div className="absolute left-1/2 top-1/2 h-[58%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-lg" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0)" }} />
        {/* Re-dim around the window using box-shadow trick on the inner frame */}
        <div
          className="absolute left-1/2 top-1/2 h-[58%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-lg ring-1 ring-white/20"
          style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
        >
          {/* Corner brackets */}
          <CornerBrackets />
          {/* Animated scan line */}
          <div className="absolute inset-x-2 top-0 bottom-0 overflow-hidden rounded-md">
            <div className="barcode-scan-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_2px_rgba(52,211,153,0.7)]" />
          </div>
        </div>

        {/* Status pill */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          {status === "scanning" ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Scanning…
            </>
          ) : status === "starting" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Starting camera…
            </>
          ) : (
            <>
              <Camera className="h-3 w-3" /> Camera idle
            </>
          )}
        </div>

        {/* Sound toggle */}
        <button
          type="button"
          onClick={() => setSoundOn((v) => !v)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/70"
          aria-label={soundOn ? "Mute beep" : "Unmute beep"}
          title={soundOn ? "Mute beep" : "Unmute beep"}
        >
          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>

        {/* Last found toast pill */}
        {lastFound && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="max-w-[200px] truncate font-mono">{lastFound}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes barcode-scan-move {
          0% { top: 0%; }
          50% { top: calc(100% - 2px); }
          100% { top: 0%; }
        }
        .barcode-scan-line {
          animation: barcode-scan-move 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" /> Scan Barcode / QR
          </DialogTitle>
          <DialogDescription>
            Point your camera at a product barcode or QR code. Detected code is sent automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {/* Camera area */}
          {supported === false ? (
            renderError()
          ) : status === "error" ? (
            renderError()
          ) : supported === null ? (
            <div className="flex h-48 items-center justify-center rounded-xl border bg-muted/30">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            renderVideo()
          )}

          {/* Continuous + sound row (only when camera is usable) */}
          {supported !== false && status !== "error" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="continuous-scan"
                  checked={continuousLocal}
                  onCheckedChange={setContinuousLocal}
                />
                <Label htmlFor="continuous-scan" className="text-xs font-medium cursor-pointer">
                  Continuous scan
                  <span className="ml-1 text-muted-foreground">(stay open)</span>
                </Label>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => { stopCamera(); setTimeout(startCamera, 80); }}
                disabled={status === "starting"}
              >
                <RefreshCw className="h-3 w-3" /> Restart
              </Button>
            </div>
          )}

          {/* Manual entry fallback — always visible */}
          <div className="space-y-1.5">
            <Label htmlFor="manual-barcode" className="flex items-center gap-1.5 text-xs font-medium">
              <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
              Manual entry
            </Label>
            <div className="flex gap-2">
              <Input
                id="manual-barcode"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitManual(); } }}
                placeholder="Type or paste barcode / SKU / QR value…"
                className="font-mono text-sm"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={submitManual}
                disabled={!manualValue.trim()}
              >
                <CheckCircle2 className="h-4 w-4" /> Use
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">Enter</kbd> to submit.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Corner brackets — four L-shaped accents around the scan window
// ────────────────────────────────────────────────────────────────────────────
function CornerBrackets() {
  const base = "absolute h-6 w-6 border-emerald-400/80";
  return (
    <>
      <div className={`${base} left-0 top-0 border-l-2 border-t-2 rounded-tl-md`} />
      <div className={`${base} right-0 top-0 border-r-2 border-t-2 rounded-tr-md`} />
      <div className={`${base} left-0 bottom-0 border-l-2 border-b-2 rounded-bl-md`} />
      <div className={`${base} right-0 bottom-0 border-r-2 border-b-2 rounded-br-md`} />
    </>
  );
}

export default BarcodeScannerDialog;
