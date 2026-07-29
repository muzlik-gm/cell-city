"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, RefreshCw, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface LiveCameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Live in-browser camera capture using getUserMedia.
 * Shows a real-time video preview and a capture button.
 * Works on desktop webcams and mobile cameras (front/back toggle).
 */
export function LiveCameraCapture({ onCapture, onClose }: LiveCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [captured, setCaptured] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    setError(null);
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      // Defer state update to avoid setState-in-effect lint warning
      queueMicrotask(() => setStreaming(true));
    } catch (e) {
      const err = e as Error;
      queueMicrotask(() => {
        if (err.name === "NotAllowedError") setError("Camera access denied. Please allow camera permission in your browser settings.");
        else if (err.name === "NotFoundError") setError("No camera found on this device.");
        else if (err.name === "NotReadableError") setError("Camera is in use by another application.");
        else setError(`Camera error: ${err.message}`);
      });
    }
  }, []);

  // Start camera on mount / facing mode change (external system sync — getUserMedia)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startCamera]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCaptured(dataUrl);
    // Convert to File
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        setCapturedFile(file);
      }
    }, "image/jpeg", 0.9);
  }, []);

  const retake = () => {
    setCaptured(null);
    setCapturedFile(null);
  };

  const confirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  };

  const switchCamera = () => {
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  };

  return (
    <div className="space-y-3">
      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-600">{error}</p>
          <Button size="sm" variant="outline" onClick={() => startCamera(facingMode)}>Retry</Button>
        </div>
      ) : captured ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border bg-black">
            <img src={captured} alt="Captured" className="mx-auto max-h-[50vh] w-auto" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={retake}>
              <RefreshCw className="h-4 w-4" /> Retake
            </Button>
            <Button className="flex-1 gap-1.5" onClick={confirm}>
              <Check className="h-4 w-4" /> Use Photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Scanning overlay */}
            {streaming && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-4 top-4 h-8 w-8 border-l-4 border-t-4 border-primary/70 rounded-tl-lg" />
                <div className="absolute right-4 top-4 h-8 w-8 border-r-4 border-t-4 border-primary/70 rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 h-8 w-8 border-b-4 border-l-4 border-primary/70 rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 h-8 w-8 border-b-4 border-r-4 border-primary/70 rounded-br-lg" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-white/70 bg-black/40 px-3 py-1 rounded-full">
                  Position the phone back or LCD in frame
                </div>
              </div>
            )}
            {!streaming && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 gap-2 h-12" disabled={!streaming} onClick={capture}>
              <Camera className="h-5 w-5" /> Capture Photo
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12" onClick={switchCamera} title="Switch camera">
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
