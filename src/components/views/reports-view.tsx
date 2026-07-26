"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBlob, toCSV, formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  ShoppingCart,
  TrendingUp,
  Package,
  AlertTriangle,
  ShieldAlert,
  Truck,
  FileSpreadsheet,
  Printer,
  Calendar,
  Database,
  Loader2,
  ChevronRight,
} from "lucide-react";

type Row = Record<string, unknown>;

interface ReportType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  hasDateFilter: boolean;
}

// 6 report types — matches the API + the new design philosophy.
const REPORT_TYPES: ReportType[] = [
  {
    id: "sales",
    label: "Sales",
    description: "All sales invoices with totals, payments, profit",
    icon: ShoppingCart,
    hasDateFilter: true,
  },
  {
    id: "profit",
    label: "Profit",
    description: "Line-item profit margins per sale",
    icon: TrendingUp,
    hasDateFilter: true,
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Full inventory snapshot with stock, valuation, location",
    icon: Database,
    hasDateFilter: false,
  },
  {
    id: "lowstock",
    label: "Low Stock",
    description: "Products at or below minimum stock threshold",
    icon: AlertTriangle,
    hasDateFilter: false,
  },
  {
    id: "damaged",
    label: "Damaged Items",
    description: "Damaged inventory with reason and value lost",
    icon: ShieldAlert,
    hasDateFilter: true,
  },
  {
    id: "purchase",
    label: "Purchases",
    description: "Purchase orders with totals and payment status",
    icon: Truck,
    hasDateFilter: true,
  },
];

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Main view ──────────────────────────────────────────────────────────
export function ReportsView() {
  const [selected, setSelected] = useState<string>("sales");
  const [from, setFrom] = useState<string>(defaultFromDate());
  const [to, setTo] = useState<string>(defaultToDate());

  const activeReport = REPORT_TYPES.find((r) => r.id === selected)!;

  const previewPath = useMemo(() => {
    const params = new URLSearchParams({ type: selected });
    if (activeReport.hasDateFilter) {
      params.set("from", new Date(from).toISOString());
      params.set("to", new Date(to + "T23:59:59").toISOString());
    }
    return `/reports?${params.toString()}`;
  }, [selected, from, to, activeReport.hasDateFilter]);

  const { data, isLoading, isError, error, refetch } = useQuery<{ type: string; rows: Row[]; count: number }>({
    queryKey: ["report-preview", selected, from, to],
    queryFn: () => api.get(previewPath),
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const headers = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);

  // ── Export: PDF (print dialog) ──────────────────────────────────────
  const exportPDF = () => {
    if (rows.length === 0) {
      toast.error("No data to print");
      return;
    }
    const html = buildPrintableHTML(activeReport.label, rows, headers);
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Popup blocked — allow popups to print");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    toast.success("Opening print dialog…");
  };

  // ── Export: Excel/CSV (client-side from preview) ────────────────────
  const exportExcel = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const csv = toCSV(rows);
    const filename = `${selected}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadBlob(csv, filename, "text/csv;charset=utf-8");
    toast.success("Excel/CSV exported");
  };

  // ── Export: CSV from server (full data, no row cap) ─────────────────
  const exportCSVServer = async () => {
    try {
      const params = new URLSearchParams({ type: selected, format: "csv" });
      if (activeReport.hasDateFilter) {
        params.set("from", new Date(from).toISOString());
        params.set("to", new Date(to + "T23:59:59").toISOString());
      }
      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const filename = `${selected}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadBlob(text, filename, "text/csv;charset=utf-8");
      toast.success("Full CSV downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Pick a report, preview the data, export to PDF or Excel — that simple."
        icon={FileText}
      />

      {/* Report cards grid */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Select a report</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_TYPES.map((r) => {
            const Icon = r.icon;
            const isActive = selected === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`group flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  isActive
                    ? "border-primary/50 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{r.label}</p>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition ${isActive ? "text-primary" : "group-hover:text-primary/70"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview card */}
      <Card className="shadow-card">
        {/* Header: title + date filter + exports */}
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="flex items-center gap-2">
                <activeReport.icon className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold">{activeReport.label} Report</h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data?.count ?? 0} record{(data?.count ?? 0) === 1 ? "" : "s"}
                {activeReport.hasDateFilter && (
                  <> · {formatDate(from)} → {formatDate(to)}</>
                )}
              </p>
            </div>
            {activeReport.hasDateFilter && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="from" className="text-[10px] uppercase tracking-wide text-muted-foreground">From</Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to" className="text-[10px] uppercase tracking-wide text-muted-foreground">To</Label>
                  <Input
                    id="to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={exportPDF} variant="outline" size="sm" disabled={isLoading || rows.length === 0} className="gap-1.5">
              <Printer className="h-4 w-4" /> Export PDF
            </Button>
            <Button onClick={exportExcel} size="sm" disabled={isLoading || rows.length === 0} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </Button>
          </div>
        </div>

        {/* Preview body */}
        <div className="p-5">
          {isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState message={error?.message ?? "Failed to load report"} onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No data for this report"
              description={
                activeReport.hasDateFilter
                  ? "Try a different date range or add records first."
                  : "There are no records matching this report yet."
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="max-h-[560px] overflow-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                    <TableRow className="hover:bg-muted/60">
                      {headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                          {prettyHeader(h)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 200).map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap text-xs">
                            {renderCell(h, row[h])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Package className="h-3 w-3" /> Showing {Math.min(200, rows.length)} of {rows.length}
                </Badge>
                <Button onClick={exportCSVServer} variant="ghost" size="sm" className="gap-1.5 text-xs">
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                  Download full CSV
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Cell rendering ─────────────────────────────────────────────────────
function prettyHeader(h: string): string {
  return h.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function renderCell(header: string, v: unknown): React.ReactNode {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "number") {
    const lower = header.toLowerCase();
    if (/price|cost|total|spent|outstanding|value|paid|profit/.test(lower)) {
      return <span className="tabular-nums font-medium">{formatCurrency(v)}</span>;
    }
    if (lower === "marginpct") return <span className="tabular-nums">{v.toFixed(2)}%</span>;
    return <span className="tabular-nums">{v.toLocaleString()}</span>;
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return formatDate(v);
  }
  return String(v);
}

// ── Printable HTML builder for PDF (print dialog) ──────────────────────
function buildPrintableHTML(title: string, rows: Row[], headers: string[]): string {
  const css = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 32px; color: #18181b; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #059669; }
    .meta { font-size: 12px; color: #71717a; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #ecfdf5; color: #065f46; text-align: left; padding: 8px 6px; border-bottom: 1px solid #a7f3d0; white-space: nowrap; }
    td { padding: 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 10px; color: #a1a1aa; text-align: center; }
    @media print { body { margin: 16px; } .no-print { display: none; } }
  `;
  const headerCells = headers.map((h) => `<th>${escapeHtml(prettyHeader(h))}</th>`).join("");
  const bodyRows = rows.map((r) => {
    const tds = headers.map((h) => {
      const v = r[h];
      let display = v == null ? "" : String(v);
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) display = formatDate(v);
      return `<td>${escapeHtml(display)}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} Report</title>
<style>${css}</style>
</head>
<body>
<h1>${escapeHtml(title)} Report</h1>
<div class="meta">Generated ${new Date().toLocaleString()} · ${rows.length} records</div>
<table>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<div class="footer">PartsHub — Mobile Spare Parts Management System</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
