"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Printer,
  X,
  ShoppingCart,
  Wallet,
  Truck,
  Wrench,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  toCSV,
  downloadBlob,
} from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────
type TxType = "sale" | "payment" | "repair" | "purchase";

interface StatementTx {
  date: string;
  type: TxType;
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementParty {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactPerson?: string | null;
  balance: number;
  createdAt: string;
}

interface StatementResponse {
  party: StatementParty;
  partyType: "customer" | "supplier";
  period: { from: string | null; to: string | null };
  openingBalance: number;
  closingBalance: number;
  transactions: StatementTx[];
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    txCount: number;
  };
}

interface StatementDialogProps {
  partyType: "customer" | "supplier";
  partyId: string;
  partyName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

// ─── Static config per transaction type ──────────────────────────────────
const TYPE_LABEL: Record<TxType, string> = {
  sale: "Sale",
  payment: "Payment",
  repair: "Repair",
  purchase: "Purchase",
};

const TYPE_BADGE: Record<TxType, string> = {
  sale: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  payment: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  repair: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  purchase: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

// ─── Component ───────────────────────────────────────────────────────────
export function StatementDialog({
  partyType,
  partyId,
  partyName,
  open,
  onOpenChange,
}: StatementDialogProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const queryStr = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", new Date(from).toISOString());
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      p.set("to", t.toISOString());
    }
    return p.toString();
  }, [from, to]);

  const {
    data: statement,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<StatementResponse>({
    queryKey: ["statement", partyType, partyId, queryStr],
    queryFn: () =>
      api.get<StatementResponse>(
        `/statements/${partyType}/${partyId}${
          queryStr ? `?${queryStr}` : ""
        }`
      ),
    enabled: open && !!partyId,
    staleTime: 30_000,
  });

  // Business info for the PDF header — best-effort fetch.
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
    enabled: open,
    staleTime: 60_000,
  });

  const handleDownloadCSV = () => {
    if (!statement?.transactions?.length) {
      toast.error("No transactions to export");
      return;
    }
    const rows = [
      {
        Date: formatDate(statement.party.createdAt),
        Type: "Opening",
        Ref: "",
        Description: "Opening balance",
        Debit: "",
        Credit: "",
        Balance: statement.openingBalance,
      },
      ...statement.transactions.map((t) => ({
        Date: formatDate(t.date),
        Type: TYPE_LABEL[t.type],
        Ref: t.ref,
        Description: t.description,
        Debit: t.debit,
        Credit: t.credit,
        Balance: t.balance,
      })),
    ];
    const csv = toCSV(rows);
    const safeName = partyName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
    const filename = `statement-${partyType}-${safeName}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    downloadBlob(csv, filename, "text/csv;charset=utf-8");
    toast.success("CSV downloaded");
  };

  const handlePrintPDF = () => {
    if (!statement) {
      toast.error("Statement not loaded yet");
      return;
    }
    const html = buildStatementHTML(statement, settings ?? {});
    const w = window.open("", "_blank", "width=1024,height=720");
    if (!w) {
      toast.error("Popup blocked — allow popups to print");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
    toast.success("Opening print dialog…");
  };

  const title =
    partyType === "customer" ? "Customer Statement" : "Supplier Statement";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-medium text-foreground">{partyName}</span> ·
            running balance statement with full transaction history
          </DialogDescription>
        </DialogHeader>

        {/* Date range filter */}
        <div className="flex flex-wrap items-end gap-3 border-b bg-muted/20 px-6 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Period:
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="stmt-from" className="text-[10px] text-muted-foreground">
              From
            </Label>
            <Input
              id="stmt-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-[150px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="stmt-to" className="text-[10px] text-muted-foreground">
              To
            </Label>
            <Input
              id="stmt-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-[150px]"
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
          <p className="ml-auto text-[11px] text-muted-foreground">
            {statement
              ? `${statement.summary.txCount} transaction${
                  statement.summary.txCount === 1 ? "" : "s"
                }`
              : "Loading…"}
          </p>
        </div>

        <ScrollArea className="max-h-[62vh]">
          <div className="px-6 py-5">
            {isLoading ? (
              <StatementSkeleton />
            ) : isError ? (
              <StatementError
                message={
                  error instanceof Error
                    ? error.message
                    : "Failed to load statement"
                }
                onRetry={() => refetch()}
              />
            ) : statement ? (
              <StatementPreview statement={statement} />
            ) : null}
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={!statement?.transactions?.length}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download CSV
          </Button>
          <Button
            size="sm"
            onClick={handlePrintPDF}
            disabled={!statement}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Preview ─────────────────────────────────────────────────────────────
function StatementPreview({ statement }: { statement: StatementResponse }) {
  const isCustomer = statement.partyType === "customer";
  const party = statement.party;

  return (
    <div className="space-y-5">
      {/* Party header */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 bg-primary/5 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isCustomer ? (
                  <User className="h-5 w-5" />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{party.name}</p>
                <p className="text-xs text-muted-foreground">
                  {isCustomer ? "Customer" : "Supplier"} · Since{" "}
                  {formatDate(party.createdAt)}
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:text-right">
            {party.company && (
              <ContactRow icon={Building2} value={party.company} />
            )}
            {party.contactPerson && (
              <ContactRow icon={User} value={party.contactPerson} />
            )}
            {party.phone && <ContactRow icon={Phone} value={party.phone} />}
            {party.email && <ContactRow icon={Mail} value={party.email} />}
            {party.address && (
              <ContactRow icon={MapPin} value={party.address} />
            )}
          </div>
        </div>
      </Card>

      {/* Period banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Period:
        </span>
        <span className="font-mono text-foreground">
          {statement.period.from ? formatDate(statement.period.from) : "All time"}
          {" → "}
          {statement.period.to ? formatDate(statement.period.to) : "Today"}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Opening Balance"
          value={formatCurrency(statement.openingBalance)}
          accent="muted"
        />
        <SummaryCard
          label={isCustomer ? "Total Invoiced" : "Total Billed"}
          value={formatCurrency(statement.summary.totalInvoiced)}
          accent="amber"
        />
        <SummaryCard
          label={isCustomer ? "Total Received" : "Total Paid"}
          value={formatCurrency(statement.summary.totalPaid)}
          accent="emerald"
        />
        <SummaryCard
          label="Closing Balance"
          value={formatCurrency(Math.abs(statement.closingBalance))}
          accent={
            statement.closingBalance > 0
              ? "rose"
              : statement.closingBalance < 0
                ? "emerald"
                : "muted"
          }
          subtitle={
            statement.closingBalance > 0
              ? isCustomer
                ? "receivable"
                : "payable"
                : statement.closingBalance < 0
                  ? "credit"
                  : "settled"
          }
        />
      </div>

      {/* Transactions table */}
      <div className="overflow-hidden rounded-xl border">
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr className="text-left font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 text-right">Debit</th>
                <th className="px-3 py-2.5 text-right">Credit</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening row */}
              <tr className="border-t bg-muted/20">
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 italic text-muted-foreground">
                  Opening balance
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-semibold tabular-nums",
                    statement.openingBalance > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : statement.openingBalance < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                  )}
                >
                  {formatCurrency(Math.abs(statement.openingBalance))}
                  {statement.openingBalance !== 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {statement.openingBalance > 0 ? "DR" : "CR"}
                    </span>
                  )}
                </td>
              </tr>
              {statement.transactions.length === 0 ? (
                <tr className="border-t">
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No transactions in this period.
                  </td>
                </tr>
              ) : (
                statement.transactions.map((tx, i) => (
                  <tr
                    key={`${tx.ref}-${tx.date}-${i}`}
                    className="border-t hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                            TYPE_BADGE[tx.type] ?? "bg-muted text-muted-foreground"
                          )}
                        >
                          {TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="truncate text-foreground"
                            title={tx.description}
                          >
                            {tx.description}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {tx.ref}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {tx.debit > 0 ? formatCurrency(tx.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {tx.credit > 0 ? formatCurrency(tx.credit) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-semibold tabular-nums",
                        tx.balance > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : tx.balance < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {formatCurrency(Math.abs(tx.balance))}
                      {tx.balance !== 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {tx.balance > 0 ? "DR" : "CR"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  value,
}: {
  icon: typeof Phone;
  value: string;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5 text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{value}</span>
    </span>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  subtitle,
}: {
  label: string;
  value: string;
  accent: "emerald" | "amber" | "rose" | "teal" | "muted";
  subtitle?: string;
}) {
  const accentClass = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    teal: "text-teal-600 dark:text-teal-400",
    muted: "text-foreground",
  }[accent];
  return (
    <div className="rounded-xl border bg-card p-3 shadow-soft">
      <p className="truncate text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", accentClass)}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────
function StatementSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-full rounded" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

function StatementError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold">Couldn&apos;t load statement</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry} size="sm" className="mt-4">
        Try again
      </Button>
    </div>
  );
}

// ─── Printable PDF (print-optimized HTML popup) ──────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(abs));
  return `${sign}Rs ${formatted}`;
}

function buildStatementHTML(
  stmt: StatementResponse,
  settings: Record<string, string>
): string {
  const bizName = settings.business_name || "Cell City";
  const bizPhone = settings.business_phone || "";
  const bizEmail = settings.business_email || "";
  const bizAddress = settings.business_address || "";
  const isCustomer = stmt.partyType === "customer";
  const title = isCustomer ? "CUSTOMER STATEMENT" : "SUPPLIER STATEMENT";
  const partyLabel = isCustomer ? "Bill To (Customer)" : "Vendor (Supplier)";

  const periodText = `${stmt.period.from ? formatDate(stmt.period.from) : "All time"} → ${
    stmt.period.to ? formatDate(stmt.period.to) : "Today"
  }`;
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Party contact lines
  const partyLines: string[] = [];
  partyLines.push(`<strong>${escapeHtml(stmt.party.name)}</strong>`);
  if (stmt.party.company) partyLines.push(escapeHtml(stmt.party.company));
  if (stmt.party.contactPerson)
    partyLines.push(`Attn: ${escapeHtml(stmt.party.contactPerson)}`);
  if (stmt.party.phone) partyLines.push(`Tel: ${escapeHtml(stmt.party.phone)}`);
  if (stmt.party.email) partyLines.push(escapeHtml(stmt.party.email));
  if (stmt.party.address) partyLines.push(escapeHtml(stmt.party.address));

  const css = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #18181b; background: #fff; }
    .doc { max-width: 820px; margin: 0 auto; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 3px solid #059669; }
    .biz { min-width: 0; }
    .biz h1 { font-size: 22px; margin: 0; color: #047857; letter-spacing: -0.02em; }
    .biz p { font-size: 11px; color: #52525b; margin: 2px 0; }
    .doc-title { text-align: right; }
    .doc-title h2 { font-size: 14px; letter-spacing: 0.12em; color: #6b7280; margin: 0 0 4px; font-weight: 600; }
    .doc-title .meta { font-size: 11px; color: #71717a; line-height: 1.5; }
    .doc-title .badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 600; margin-bottom: 4px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; }
    .panel { border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px 14px; }
    .panel h3 { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #71717a; margin: 0 0 6px; font-weight: 600; }
    .panel p { font-size: 12px; margin: 1px 0; color: #27272a; }
    .panel .name { font-size: 13px; font-weight: 600; color: #18181b; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 18px; }
    .sum-card { border: 1px solid #e4e4e7; border-radius: 6px; padding: 10px 12px; background: #fafafa; }
    .sum-card .l { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #71717a; font-weight: 600; }
    .sum-card .v { font-size: 14px; font-weight: 700; margin-top: 3px; }
    .sum-card.opening .v { color: #52525b; }
    .sum-card.invoiced .v { color: #d97706; }
    .sum-card.paid .v { color: #059669; }
    .sum-card.closing .v { color: ${stmt.closingBalance > 0 ? "#e11d48" : stmt.closingBalance < 0 ? "#059669" : "#52525b"}; }
    .sum-card.closing .sub { font-size: 9px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px; }
    h3.section { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #52525b; margin: 22px 0 8px; font-weight: 600; padding-bottom: 4px; border-bottom: 1px solid #e4e4e7; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { background: #f4f4f5; color: #3f3f46; text-align: left; padding: 8px 10px; border-bottom: 2px solid #d4d4d8; font-weight: 600; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
    thead th.right { text-align: right; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tbody td.right { text-align: right; font-variant-numeric: tabular-nums; }
    tbody tr.opening { background: #fafafa; font-style: italic; color: #71717a; }
    tbody tr.opening td { color: #71717a; }
    tbody tr:hover { background: #f9fafb; }
    .type-pill { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 6px; vertical-align: middle; }
    .type-sale { background: #ecfdf5; color: #047857; }
    .type-payment { background: #f0fdfa; color: #0d9488; }
    .type-purchase { background: #faf5ff; color: #7e22ce; }
    .type-repair { background: #fffbeb; color: #b45309; }
    .debit { color: #b45309; font-weight: 600; }
    .credit { color: #059669; font-weight: 600; }
    .bal-dr { color: #b45309; font-weight: 600; }
    .bal-cr { color: #059669; font-weight: 600; }
    .bal-zero { color: #71717a; }
    .ref { font-family: 'SF Mono', 'Menlo', monospace; font-size: 10px; color: #71717a; }
    .desc { color: #27272a; }
    .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
    .totals-box { min-width: 280px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 14px; background: #fafafa; }
    .totals-row { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; }
    .totals-row.grand { font-size: 13px; font-weight: 700; border-top: 2px solid #d4d4d8; padding-top: 7px; margin-top: 4px; color: ${stmt.closingBalance > 0 ? "#e11d48" : stmt.closingBalance < 0 ? "#059669" : "#18181b"}; }
    .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e4e4e7; font-size: 10px; color: #a1a1aa; text-align: center; line-height: 1.5; }
    .footer strong { color: #71717a; }
    .note { margin-top: 16px; font-size: 10px; color: #71717a; font-style: italic; text-align: center; }
    @media print { body { padding: 16px; } .doc { max-width: 100%; } }
  `;

  // Build line items (opening + each transaction)
  const openingRow = `
    <tr class="opening">
      <td>—</td>
      <td colspan="3">Opening balance</td>
      <td class="right ${stmt.openingBalance === 0 ? "bal-zero" : stmt.openingBalance > 0 ? "bal-dr" : "bal-cr"}">
        ${stmt.openingBalance === 0 ? "—" : `${fmtMoney(stmt.openingBalance)} ${stmt.openingBalance > 0 ? "DR" : "CR"}`}
      </td>
    </tr>`;

  const bodyRows = stmt.transactions
    .map((tx) => {
      const balClass =
        tx.balance === 0
          ? "bal-zero"
          : tx.balance > 0
            ? "bal-dr"
            : "bal-cr";
      const balText =
        tx.balance === 0
          ? "—"
          : `${fmtMoney(tx.balance)} ${tx.balance > 0 ? "DR" : "CR"}`;
      return `
      <tr>
        <td>${escapeHtml(formatDate(tx.date))}</td>
        <td>
          <span class="type-pill type-${tx.type}">${escapeHtml(TYPE_LABEL[tx.type] || tx.type)}</span>
          <span class="desc">${escapeHtml(tx.description)}</span>
          <div class="ref">${escapeHtml(tx.ref)}</div>
        </td>
        <td class="right debit">${tx.debit > 0 ? escapeHtml(fmtMoney(tx.debit)) : "—"}</td>
        <td class="right credit">${tx.credit > 0 ? escapeHtml(fmtMoney(tx.credit)) : "—"}</td>
        <td class="right ${balClass}">${escapeHtml(balText)}</td>
      </tr>`;
    })
    .join("");

  const closingLabel = isCustomer
    ? stmt.closingBalance > 0
      ? "Outstanding Receivable"
      : stmt.closingBalance < 0
        ? "Credit Balance (advance)"
        : "Account Settled"
    : stmt.closingBalance > 0
      ? "Outstanding Payable"
      : stmt.closingBalance < 0
        ? "Credit Balance (overpaid)"
        : "Account Settled";

  const partyBlock = partyLines.map((l, i) =>
    i === 0 ? `<p class="name">${l}</p>` : `<p>${l}</p>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — ${escapeHtml(stmt.party.name)}</title>
<style>${css}</style>
</head>
<body>
<div class="doc">
  <div class="header">
    <div class="biz">
      <h1>${escapeHtml(bizName)}</h1>
      ${bizAddress ? `<p>${escapeHtml(bizAddress)}</p>` : ""}
      ${bizPhone ? `<p>Tel: ${escapeHtml(bizPhone)}</p>` : ""}
      ${bizEmail ? `<p>${escapeHtml(bizEmail)}</p>` : ""}
    </div>
    <div class="doc-title">
      <span class="badge">${escapeHtml(isCustomer ? "RECEIVABLE" : "PAYABLE")}</span>
      <h2>${escapeHtml(title)}</h2>
      <div class="meta">
        Generated: ${escapeHtml(generatedAt)}<br>
        Period: ${escapeHtml(periodText)}<br>
        Transactions: ${stmt.summary.txCount}
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="panel">
      <h3>${escapeHtml(partyLabel)}</h3>
      ${partyBlock}
    </div>
    <div class="panel">
      <h3>Statement Period</h3>
      <p><strong>From:</strong> ${escapeHtml(stmt.period.from ? formatDate(stmt.period.from) : "Account opening")}</p>
      <p><strong>To:</strong> ${escapeHtml(stmt.period.to ? formatDate(stmt.period.to) : "Today")}</p>
      <p><strong>Customer since:</strong> ${escapeHtml(formatDate(stmt.party.createdAt))}</p>
    </div>
  </div>

  <div class="summary">
    <div class="sum-card opening">
      <div class="l">Opening Balance</div>
      <div class="v">${escapeHtml(fmtMoney(stmt.openingBalance))}</div>
    </div>
    <div class="sum-card invoiced">
      <div class="l">${isCustomer ? "Total Invoiced" : "Total Billed"}</div>
      <div class="v">${escapeHtml(fmtMoney(stmt.summary.totalInvoiced))}</div>
    </div>
    <div class="sum-card paid">
      <div class="l">${isCustomer ? "Total Received" : "Total Paid"}</div>
      <div class="v">${escapeHtml(fmtMoney(stmt.summary.totalPaid))}</div>
    </div>
    <div class="sum-card closing">
      <div class="l">Closing Balance</div>
      <div class="v">${escapeHtml(fmtMoney(Math.abs(stmt.closingBalance)))}${stmt.closingBalance !== 0 ? ` ${stmt.closingBalance > 0 ? "DR" : "CR"}` : ""}</div>
      <div class="sub">${escapeHtml(closingLabel)}</div>
    </div>
  </div>

  <h3 class="section">Transaction History</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 90px">Date</th>
        <th>Description</th>
        <th class="right" style="width: 110px">Debit</th>
        <th class="right" style="width: 110px">Credit</th>
        <th class="right" style="width: 130px">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${openingRow}
      ${bodyRows || `<tr><td colspan="5" style="text-align:center;color:#71717a;padding:20px">No transactions in this period.</td></tr>`}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Opening Balance</span><span>${escapeHtml(fmtMoney(stmt.openingBalance))}</span></div>
      <div class="totals-row"><span>${isCustomer ? "Total Invoiced" : "Total Billed"}</span><span class="debit">${escapeHtml(fmtMoney(stmt.summary.totalInvoiced))}</span></div>
      <div class="totals-row"><span>${isCustomer ? "Total Received" : "Total Paid"}</span><span class="credit">${escapeHtml(fmtMoney(stmt.summary.totalPaid))}</span></div>
      <div class="totals-row grand"><span>${escapeHtml(closingLabel)}</span><span>${escapeHtml(fmtMoney(Math.abs(stmt.closingBalance)))}${stmt.closingBalance !== 0 ? ` ${stmt.closingBalance > 0 ? "DR" : "CR"}` : ""}</span></div>
    </div>
  </div>

  <p class="note">This statement is computer-generated and reflects transactions recorded in the Cell City system as of ${escapeHtml(generatedAt)}.</p>

  <div class="footer">
    <strong>${escapeHtml(bizName)}</strong>${bizAddress ? ` · ${escapeHtml(bizAddress)}` : ""}${bizPhone ? ` · Tel: ${escapeHtml(bizPhone)}` : ""}<br>
    Cell City — Mobile Spare Parts Management System
  </div>
</div>
</body>
</html>`;
}
