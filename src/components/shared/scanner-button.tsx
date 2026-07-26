"use client";

// ────────────────────────────────────────────────────────────────────────────
// ScannerButton — a small reusable trigger that opens the BarcodeScannerDialog.
//
// Usage:
//   <ScannerButton onDetected={(code) => console.log(code)} />
//   <ScannerButton onDetected={...} label="Scan" continuous />
// ────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { BarcodeScannerDialog } from "@/components/shared/barcode-scanner";

export interface ScannerButtonProps {
  /** Fired with the detected/entered code value. */
  onDetected: (value: string) => void;
  /** Optional label (defaults to "Scan"). */
  label?: string;
  /** Optional className override for the button. */
  className?: string;
  /** Optional shadcn button variant (defaults to "outline"). */
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  /** Optional button size (defaults to "sm"). */
  size?: "default" | "sm" | "lg" | "icon";
  /** When true, the scanner stays open after each detection. */
  continuous?: boolean;
  /** Optional disabled flag. */
  disabled?: boolean;
}

export function ScannerButton({
  onDetected,
  label = "Scan",
  className,
  variant = "outline",
  size = "sm",
  continuous = false,
  disabled = false,
}: ScannerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
      >
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </Button>

      <BarcodeScannerDialog
        open={open}
        onOpenChange={setOpen}
        onDetected={onDetected}
        continuous={continuous}
      />
    </>
  );
}

export default ScannerButton;
