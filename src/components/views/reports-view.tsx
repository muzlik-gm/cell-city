"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/data-table";
import { downloadBlob, toCSV, formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  FileText,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  PackageOpen,
  AlertTriangle,
  ShieldAlert,
  FileSpreadsheet,
  FileDown,
  Printer,
  Calendar,
  Database,
  Loader2,
} from "lucide-react";

type Row = Record<string, unknown>;

interface ReportType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hasDateFilter: boolean;
}

const REPORT_TYPES: ReportType[] = [
  { id: "inventory", label: "Inventory", description: "Full inventory snapshot with stock, valuation, location", icon: Database, color: "emerald", hasDateFilter: false },
  { id: "sales", label: "Sales", description: "All sales invoices with totals, payments, profit", icon: ShoppingCart, color: "emerald", hasDateFilter: true },
  { id: "profit", label: "Profit", description: "Line-item profit margins per sale", icon: TrendingUp, color: "teal", hasDateFilter: true },
  { id: "supplier", label: "Supplier", description: "Supplier performance with purchases and outstanding", icon: Truck, color: "amber", hasDateFilter: false },
  { id: "customer", label: "Customer", description: "Customer spend summary and outstanding balances", icon: Users, color: "purple", hasDateFilter: false },
  { id: "repair", label: "Repair", description: "Repair jobs with status, technician, costs", icon: Wrench, color: "teal", hasDateFilter: true },
  { id: "purchase", label: "Purchase", description: "Purchase orders with totals and payment status", icon: PackageOpen, color: "purple", hasDateFilter: true },
  { id: "lowstock", label: "Low Stock", description: "Products at or below minimum stock threshold", icon: AlertTriangle, color: "amber", hasDateFilter: false },
  { id: "damaged", label: "Damaged", description: "Damaged inventory with reason and value lost", icon: ShieldAlert, color: "rose", hasDateFilter: true },
];

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-teal-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20",
};

const selectedRingMap: Record<string, string> = {
  emerald: "ring-emerald-500/50 border-emerald-500/50",
  teal: "ring-teal-500/50 border-teal-500/50",
  amber: "ring-amber-500/50 border-amber-500/50",
  purple: "ring-purple-500/50 border-purple-500/50",
  rose: "ring-rose-500/50 border-rose-500/50",
};

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsView() {
  const [selected, setSelected] = useState<string>("inventory");
  const [from, setFrom] = useState<string>(defaultFromDate());
  const [to, setTo] = useState<string>(defaultToDate());

  const activeReport = REPORT_TYPES.find((r) => r.id === selected)!;

  // Build query path for preview (JSON)
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
  const columns: Column<Row>[] = useMemo(() => {
    if (rows.length === 0) return [];
    const headers = Object.keys(rows[0]);
    return headers.map((h) => ({
      key: h,
      header: h.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim(),
      render: (r: Row) => {
        const v = r[h];
        if (v == null) return "—";
        if (typeof v === "number") {
          // Heuristic: currency-like fields
          const lower = h.toLowerCase();
          if (/price|cost|total|spent|outstanding|value|paid|profit|margin/.test(lower)) {
            return formatCurrency(v);
          }
          if (/qty|stock|count|deficit|items/.test(lower)) {
            return String(v);
          }
          if (lower === "marginpct") return `${v.toFixed(2)}%`;
          return v.toLocaleString();
        }
        if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          return formatDate(v);
        }
        return String(v);
      },
    }));
  }, [rows]);

  // Exports
  const exportCSVFromServer = async () => {
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
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  const exportCSVFromClient = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const csv = toCSV(rows);
    const filename = `${selected}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadBlob(csv, filename, "text/csv;charset=utf-8");
    toast.success("CSV exported from preview");
  };

  const exportExcel = () => {
    // We have no xlsx library — export CSV (Excel-compatible) with .csv extension
    // and label it "Excel/CSV" so users understand.
    exportCSVFromClient();
  };

  const exportPDF = () => {
    if (rows.length === 0) {
      toast.error("No data to print");
      return;
    }
    const html = buildPrintableHTML(activeReport.label, rows, columns.map((c) => c.header));
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and export business reports"
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
                className={`group flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-soft transition hover:shadow-md ${
                  isActive ? `${selectedRingMap[r.color]} ring-2` : "border-border hover:border-primary/30"
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${colorMap[r.color]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{r.label}</p>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range + Export controls */}
      <Card className="p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{activeReport.label} Report</span>
            </div>
            {activeReport.hasDateFilter && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="from" className="text-xs text-muted-foreground">From</Label>
                  <Input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
                  <Input
                    id="to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={exportPDF} variant="outline" size="sm" disabled={isLoading || rows.length === 0} className="gap-1.5">
              <Printer className="h-4 w-4" /> PDF
            </Button>
            <Button onClick={exportExcel} variant="outline" size="sm" disabled={isLoading || rows.length === 0} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Excel/CSV
            </Button>
            <Button onClick={exportCSVFromServer} variant="outline" size="sm" disabled={isLoading} className="gap-1.5">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} CSV (server)
            </Button>
            <Button onClick={exportCSVFromClient} size="sm" disabled={isLoading || rows.length === 0} className="gap-1.5">
              <FileDown className="h-4 w-4" /> Export Preview
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview */}
      <Card className="p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{activeReport.label} Report Preview</h3>
            <p className="text-xs text-muted-foreground">
              {data?.count ?? 0} records {activeReport.hasDateFilter ? `· ${formatDate(from)} to ${formatDate(to)}` : ""}
            </p>
          </div>
          {rows.length > 0 && <Badge variant="secondary">{rows.length} rows shown</Badge>}
        </div>

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={error?.message ?? "Failed to load report"} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No data for this report"
            description="Try a different date range or add records first."
          />
        ) : (
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <DataTable
              columns={columns.slice(0, 12)}
              data={rows.slice(0, 200)}
              emptyTitle="No records"
            />
            {rows.length > 200 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing first 200 of {rows.length} rows · export CSV for full data
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Printable HTML builder for PDF (print dialog) ──────────────────────
function buildPrintableHTML(title: string, rows: Row[], headers: string[]): string {
  const css = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 32px; color: #18181b; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #71717a; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f4f4f5; text-align: left; padding: 8px 6px; border-bottom: 1px solid #e4e4e7; white-space: nowrap; }
    td { padding: 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 10px; color: #a1a1aa; text-align: center; }
    @media print { body { margin: 16px; } .no-print { display: none; } }
  `;
  const headerCells = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
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
