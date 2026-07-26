"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, timeAgo } from "@/lib/format";
import { EmptyState, LoadingState, ErrorState } from "@/components/shared/states";
import {
  ShoppingCart,
  Wallet,
  Truck,
  Wrench,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────
export type TimelineTxType = "sale" | "payment" | "repair" | "purchase";

export interface TimelineTx {
  date: string;
  type: TimelineTxType;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementLike {
  transactions: TimelineTx[];
}

interface ActivityTimelineProps {
  /** When provided, the component renders directly from this array (no fetch). */
  transactions?: TimelineTx[];
  /** When transactions is not provided, fetch from the statement API. */
  partyId?: string;
  partyType?: "customer" | "supplier";
  /** Limit the visible items (most recent N). Default 10. */
  limit?: number;
  /** Compact density (smaller dots, tighter spacing). Default false. */
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

// ─── Static config per transaction type ──────────────────────────────────
const TYPE_CONFIG: Record<
  TimelineTxType,
  { icon: LucideIcon; dot: string; ring: string; chip: string; label: string }
> = {
  sale: {
    icon: ShoppingCart,
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20",
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "Sale",
  },
  payment: {
    icon: Wallet,
    dot: "bg-teal-500",
    ring: "ring-teal-500/20",
    chip: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    label: "Payment",
  },
  purchase: {
    icon: Truck,
    dot: "bg-purple-500",
    ring: "ring-purple-500/20",
    chip: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    label: "Purchase",
  },
  repair: {
    icon: Wrench,
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "Repair",
  },
};

// ─── Component ───────────────────────────────────────────────────────────
export function ActivityTimeline({
  transactions,
  partyId,
  partyType,
  limit = 10,
  compact = false,
  emptyTitle = "No activity yet",
  emptyDescription = "Transactions for this party will appear here in chronological order.",
  className,
}: ActivityTimelineProps) {
  // Direct prop path — no fetch.
  if (transactions) {
    return (
      <TimelineBody
        transactions={transactions}
        limit={limit}
        compact={compact}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        className={className}
      />
    );
  }

  // Fetch path — needs partyId + partyType.
  if (!partyId || !partyType) {
    return (
      <EmptyState
        icon={Clock}
        title="Missing party info"
        description="Provide either `transactions` or both `partyId` and `partyType`."
        className={className}
      />
    );
  }

  return (
    <TimelineFetcher
      partyId={partyId}
      partyType={partyType}
      limit={limit}
      compact={compact}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      className={className}
    />
  );
}

// ─── Fetcher wrapper ─────────────────────────────────────────────────────
function TimelineFetcher({
  partyId,
  partyType,
  limit,
  compact,
  emptyTitle,
  emptyDescription,
  className,
}: {
  partyId: string;
  partyType: "customer" | "supplier";
  limit: number;
  compact: boolean;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery<StatementLike>({
    queryKey: ["statement", partyType, partyId],
    queryFn: () =>
      api.get<StatementLike>(`/statements/${partyType}/${partyId}`),
    enabled: !!partyId && !!partyType,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <LoadingState className={className} />;
  }
  if (isError) {
    return (
      <ErrorState
        message={
          error instanceof Error ? error.message : "Failed to load activity"
        }
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <TimelineBody
      transactions={data?.transactions ?? []}
      limit={limit}
      compact={compact}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      className={className}
    />
  );
}

// ─── Body ────────────────────────────────────────────────────────────────
function TimelineBody({
  transactions,
  limit,
  compact,
  emptyTitle,
  emptyDescription,
  className,
}: {
  transactions: TimelineTx[];
  limit: number;
  compact: boolean;
  emptyTitle: string;
  emptyDescription: string;
  className?: string;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon={Clock}
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      />
    );
  }

  // Most recent first; cap at `limit`.
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const visible = limit > 0 ? sorted.slice(0, limit) : sorted;

  return (
    <div className={cn("relative", className)}>
      {/* Vertical connecting line — sits behind the dots. */}
      <div
        className={cn(
          "absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent",
          compact && "left-[11px]"
        )}
        aria-hidden
      />

      <ol className="space-y-1">
        {visible.map((tx, i) => (
          <TimelineItem
            key={`${tx.ref}-${tx.date}-${i}`}
            tx={tx}
            compact={compact}
            isLast={i === visible.length - 1}
          />
        ))}
      </ol>

      {limit > 0 && transactions.length > limit && (
        <p className="mt-3 pl-8 text-xs text-muted-foreground">
          Showing {limit} of {transactions.length} activities.
        </p>
      )}
    </div>
  );
}

function TimelineItem({
  tx,
  compact,
  isLast,
}: {
  tx: TimelineTx;
  compact: boolean;
  isLast: boolean;
}) {
  const cfg = TYPE_CONFIG[tx.type] ?? TYPE_CONFIG.payment;
  const Icon = cfg.icon;
  const isCredit = tx.credit > 0; // payment reduces the party balance
  const isDebit = tx.debit > 0; // invoice/purchase increases the party balance
  const sign = isCredit ? "−" : isDebit ? "+" : "";

  return (
    <li
      className={cn(
        "group relative flex gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-muted/40",
        isLast && "pb-0"
      )}
    >
      {/* Dot + icon */}
      <div className="relative z-10 flex shrink-0 items-start pt-0.5">
        <div
          className={cn(
            "flex items-center justify-center rounded-full ring-2 ring-background",
            compact ? "h-[22px] w-[22px]" : "h-[30px] w-[30px]",
            cfg.dot,
            cfg.ring
          )}
        >
          <Icon className={cn("text-white", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  cfg.chip
                )}
              >
                {cfg.label}
              </span>
              <span className="truncate text-xs font-medium text-muted-foreground">
                {tx.ref}
              </span>
            </div>
            <p
              className="mt-0.5 truncate text-sm text-foreground"
              title={tx.description}
            >
              {tx.description}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDate(tx.date)} · {timeAgo(tx.date)}
            </p>
          </div>

          {/* Amount + running balance */}
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "text-sm font-semibold tabular-nums",
                isCredit
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isDebit
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
              )}
            >
              {sign}
              {formatCurrency(isCredit ? tx.credit : tx.debit)}
            </p>
            {tx.balance !== 0 || isCredit || isDebit ? (
              <p
                className={cn(
                  "text-[11px] tabular-nums",
                  tx.balance > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : tx.balance < 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                )}
                title="Running balance"
              >
                Bal {formatCurrency(Math.abs(tx.balance))}
                {tx.balance < 0 ? " CR" : tx.balance > 0 ? " DR" : ""}
              </p>
            ) : null}
            {isCredit ? (
              <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="h-2.5 w-2.5" /> received
              </p>
            ) : isDebit ? (
              <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                <ArrowUpRight className="h-2.5 w-2.5" /> charged
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
