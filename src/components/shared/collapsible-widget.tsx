"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsibleWidgetProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  className?: string;
}

/**
 * A collapsible widget wrapper with a header that expands/collapses.
 * Persists open/closed state to localStorage if storageKey is provided.
 */
export function CollapsibleWidget({
  title,
  icon,
  badge,
  action,
  children,
  defaultOpen = true,
  storageKey,
  className,
}: CollapsibleWidgetProps) {
  const [open, setOpen] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`pw-${storageKey}`);
        if (stored !== null) return stored === "true";
      } catch { /* ignore */ }
    }
    return defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey && typeof window !== "undefined") {
      try { localStorage.setItem(`pw-${storageKey}`, String(next)); } catch { /* ignore */ }
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-soft", className)}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        {icon && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>}
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
          {badge}
          <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
