"use client";

// ────────────────────────────────────────────────────────────────────────────
// QuickRestockButton — a small reusable trigger that opens a simplified
// restock dialog (StockAdjustDialog pre-set to "Add Stock" / IN mode).
//
// Usage:
//   <QuickRestockButton product={p} />
//   <QuickRestockButton product={p} label="Restock" variant="outline" />
// ────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine } from "lucide-react";
import { StockAdjustDialog } from "@/components/shared/stock-adjust-dialog";
import { cn } from "@/lib/utils";

export interface QuickRestockButtonProps {
  /** The product to restock. */
  product: any;
  /** Optional label (defaults to "Restock"). Hidden on `<sm` for compactness. */
  label?: string;
  /** Optional className override for the button. */
  className?: string;
  /** Optional shadcn button variant (defaults to "default" — primary emerald). */
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  /** Optional button size (defaults to "sm"). */
  size?: "default" | "sm" | "lg" | "icon";
  /** Optional disabled flag. */
  disabled?: boolean;
  /** Stop click propagation (useful inside table rows / clickable rows). */
  stopPropagation?: boolean;
}

export function QuickRestockButton({
  product,
  label = "Restock",
  className,
  variant = "default",
  size = "sm",
  disabled = false,
  stopPropagation = false,
}: QuickRestockButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        disabled={disabled}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          setOpen(true);
        }}
        aria-label={label}
        title={label}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </Button>

      <StockAdjustDialog
        product={open ? product : null}
        open={open}
        onOpenChange={setOpen}
        initialMode="IN"
      />
    </>
  );
}

export default QuickRestockButton;
