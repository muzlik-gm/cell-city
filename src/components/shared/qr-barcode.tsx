"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface QrDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrDisplay({ value, size = 128, className }: QrDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [value, size]);

  if (!dataUrl)
    return <div className={cn("animate-pulse rounded-lg bg-muted", className)} style={{ width: size, height: size }} />;

  return <img src={dataUrl} alt={`QR ${value}`} width={size} height={size} className={cn("rounded-lg", className)} />;
}

// Renders a simple faux barcode (visual only) using vertical bars based on the string
export function BarcodeDisplay({ value, className, height = 48 }: { value: string; className?: string; height?: number }) {
  if (!value) return null;
  const bars: React.ReactNode[] = [];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const w = (code % 3) + 1;
    bars.push(
      <div
        key={i}
        style={{ width: w }}
        className={i % 2 === 0 ? "bg-foreground" : "bg-transparent"}
        // alternate via char parity for a realistic look
      />
    );
  }
  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div className="flex items-end gap-px" style={{ height }}>
        {value.split("").map((c, i) => {
          const code = c.charCodeAt(0);
          const w = (code % 3) + 1;
          return <div key={i} style={{ width: w, height: "100%" }} className={i % 2 === 0 ? "bg-foreground" : "bg-foreground/0"} />;
        })}
      </div>
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground">{value}</span>
    </div>
  );
}
