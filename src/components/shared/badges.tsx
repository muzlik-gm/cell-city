"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Quality, Condition, RepairStatus } from "@/lib/types";

const qualityStyle: Record<Quality, string> = {
  ORIGINAL: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  OEM: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  COPY: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  PREMIUM_COPY: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  REFURBISHED: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
};

export function QualityBadge({ quality }: { quality: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", qualityStyle[quality as Quality] ?? "bg-muted text-muted-foreground")}>
      {quality.replace("_", " ")}
    </Badge>
  );
}

export function ConditionBadge({ condition }: { condition: string }) {
  const map: Record<Condition, string> = {
    NEW: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    USED: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    REFURBISHED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return <Badge variant="outline" className={cn("font-medium", map[condition as Condition])}>{condition}</Badge>;
}

export function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock <= 0)
    return <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400">Out of stock</Badge>;
  if (stock <= minStock)
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Low · {stock}</Badge>;
  return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{stock} in stock</Badge>;
}

const repairStatusStyle: Record<RepairStatus, string> = {
  RECEIVED: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  DIAGNOSED: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  WAITING_PARTS: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  REPAIRING: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  DELIVERED: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  CANCELLED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function RepairStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", repairStatusStyle[status as RepairStatus] ?? "bg-muted text-muted-foreground")}>
      {status.replace("_", " ").toLowerCase()}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PARTIAL: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    UNPAID: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return <Badge variant="outline" className={cn("font-medium capitalize", map[status] ?? "bg-muted")}>{status.toLowerCase()}</Badge>;
}

export function PaymentMethodBadge({ method }: { method: string }) {
  return <Badge variant="secondary" className="font-medium">{method}</Badge>;
}
