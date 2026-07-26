# Task 5-b — Simplified Repairs (Kanban) & Reports views

- **Task ID:** 5-b
- **Agent:** Repairs & Reports simplification subagent (Z.ai Code)
- **Task:** Rewrite `src/components/views/repairs-view.tsx` and `src/components/views/reports-view.tsx` to embody the new "speed & minimal clicks" design philosophy. Repairs → simple 6-column Kanban + New Ticket dialog + detail sheet. Reports → clean grid of 6 report cards + preview table + Export PDF / Export Excel buttons. No complex tabs, no damaged inventory tab in repairs, no report builder.

## Work Log

### Files REWRITTEN (2):

#### 1. `src/components/views/repairs-view.tsx` (~1160 lines, full rewrite)

**New architecture (simple & fast):**
- **Single source of truth**: one `useQuery` fetches `/repairs?pageSize=200` to get every ticket (with customer, model+brand, technician, parts) in one shot. The kanban groups client-side — no per-column fetches, no pagination, no infinite scroll.
- **6-column Kanban** (matches the spec exactly): Received → Diagnosed → Waiting Parts → Repairing → Ready (COMPLETED) → Delivered. `CANCELLED` is filtered out of the kanban entirely.
  - Each column header: color-coded icon badge + label + ticket count + colored underline bar.
  - Color palette (emerald system, NO indigo/blue): zinc (Received), teal (Diagnosed), amber (Waiting Parts), purple (Repairing), emerald-500 (Ready), emerald-700 (Delivered).
  - Horizontal-scroll board on mobile (`overflow-x-auto` + `min-w-max` + fixed `w-[280px]` columns); each column body has its own `max-h` + vertical scroll.
- **Kanban cards**: ticket no (mono, muted) + age (`timeAgo(receivedAt)`) on row 1; customer name (bold) on row 2; phone model (with Smartphone icon, truncated) on row 3; problem (`line-clamp-2`) on row 4; bottom row: technician avatar (initials, primary-tinted) or unassigned ghost + technician name, plus total cost in emerald on the right. Hover lift + shadow + ring focus.
- **New Ticket dialog**: simple 6-field form — Customer (Select, required), Phone model (Select), IMEI (Input, optional), Problem (Textarea, required), Technician (Select), Labor cost (Number). On submit → `POST /repairs` → invalidates `["repairs"]` → ticket lands in "Received" column. Resets form + closes dialog. Sonner toasts for success/error.
- **Detail sheet** (`Sheet` from right, max-w-lg): emerald-tinted gradient header (ticket no + received time + status badge); "Move to status" Select (PATCHes immediately on change — 7 options incl. CANCELLED); Customer + Phone info cards (icon + label + value + sub); Problem card; Diagnosis textarea; Technician Select + Labor + Paid 3-col grid; Notes textarea; "Save details" button (single PATCH with all editable fields); Parts section (inline search-and-add with `?q=` product lookup, qty input, "Use now" checkbox, USED/RESERVED toggle pill per part with stock deduction, X-to-remove); Cost summary card (Labor/Parts/Paid/Total + amber "Balance due" banner if unpaid); Timeline (4-step progress: Received→Diagnosed→Completed→Delivered with checkmark dots); "Delete ticket" ghost-rose button with confirm.
  - **Keyed-remount pattern**: `RepairDetailSheet` (owns Sheet open state) renders `<RepairSheetBody key={repair.id} ... />`. The inner component initializes its editable `useState` from `repair` once per mount — clean state reset on ticket change without refs or effects. This was the cleanest fix for the `react-hooks/refs` and `react-hooks/set-state-in-effect` lint rules.
- **Top toolbar**: PageHeader with inline search (ticket no / customer / phone / IMEI / technician) + "New Ticket" button. Below: quick-stat strip (total tickets, active count, error badge if load failed).
- **States**: `LoadingState` (centered spinner) while fetching; `EmptyState` with "New Ticket" CTA when no tickets exist; retry button on error.

#### 2. `src/components/views/reports-view.tsx` (~340 lines, full rewrite)

**New architecture (pick → preview → export):**
- **6 report cards** in a responsive grid (1/2/3 cols): Sales, Profit, Inventory, Low Stock, Damaged Items, Purchases. Each card: emerald-tinted icon badge + title + 2-line description + chevron. Selected card gets primary ring + border. Click → sets `selected` state.
- **Report → API type mapping**: sales→`sales`, profit→`profit`, inventory→`inventory`, lowstock→`lowstock`, damaged→`damaged`, purchase→`purchase`. Honors the existing `/api/reports?type=X` contract.
- **Preview card** below the grid:
  - Header row: report title (with icon) + record count + date range hint, then date-range inputs (only shown for reports with `hasDateFilter: true` — sales/profit/damaged/purchase), then Export PDF + Export Excel buttons on the right.
  - Body: sticky-header `<Table>` (max-h-560, overflow-auto), first 200 rows rendered, with smart cell rendering (currency for `price|cost|total|spent|outstanding|value|paid|profit` fields, % for `marginPct`, formatted dates for ISO strings, `—` for empty). Footer: "Showing N of M" badge + "Download full CSV" ghost button (server-side CSV with no row cap).
  - States: `LoadingState` while fetching; `ErrorState` with retry on failure; `EmptyState` when 0 rows.
- **Exports**:
  - **Export PDF** (Printer icon): opens a new window with a fully self-contained HTML doc (inline `<style>`, emerald-tinted header `#059669`, sticky-looking table head `#ecfdf5`/`#065f46`, zebra rows, footer) → calls `window.print()` after 300ms. All HTML escaped.
  - **Export Excel** (FileSpreadsheet icon): client-side `toCSV(rows)` + `downloadBlob` — produces an Excel-compatible CSV file named `{type}-report-{date}.csv`. Labeled "Export Excel" per spec but produces CSV (the project has no xlsx library, consistent with the prior reports-view convention).
  - **Download full CSV** (ghost link): server-side `?format=csv` for the full row set (no 200-row preview cap).
- **Removed**: the old "Export Preview" button, the "CSV (server)" button, the duplicate export controls. Simplified to just 2 primary export buttons + 1 secondary "full CSV" link — matches the spec's "Export PDF / Export Excel" requirement.

### Key decisions
- **Kanban-only for Repairs**: spec said "NO table view toggle — just the kanban (it's the simplest, most visual)." I removed the old DataTable tab entirely. Cards are the single interaction surface; click → sheet for full detail. Minimal clicks: 1 click to open a ticket, 1 dropdown change to move status, 1 button to save edits.
- **Status labels**: spec uses "Ready" for COMPLETED in the column header (more user-friendly than "Completed"), but the underlying API status stays `COMPLETED`. The dropdown shows "Ready" too for consistency. CANCELLED is available in the dropdown (so users can cancel a ticket) but is not a kanban column.
- **Keyed-remount over ref-sync**: the initial implementation used `useRef` to detect repair-id changes and sync local state — flagged by `react-hooks/refs`. Switching to `useEffect` was flagged by `react-hooks/set-state-in-effect`. Final solution: split into outer `RepairDetailSheet` (owns Sheet open state) + inner `RepairSheetBody key={repair.id}` (initializes `useState` from `repair` once per mount). Clean, idiomatic React, no rules violated.
- **Parts search**: debounced via `enabled: query.length >= 2` on the products query. Reuses `/api/products?q=...&pageSize=50`. Selecting a product moves it into the qty/use-now/Add row.
- **Color palette**: emerald primary, complementary teal/amber/purple/zinc/rose accents. NO indigo, NO blue, NO sky. Delivered uses emerald-700 (darker) to visually distinguish from Ready (emerald-500) while staying in the emerald family.
- **Reports**: kept the simple date-range filter (only for date-filtered report types) since it was already trivial. The spec said "optional simple date range if easy" — it was easy, so I kept it. No report builder, no analytics charts.

### Verification
- **`bun run lint`**: **0 errors / 0 warnings** project-wide (verified twice — initial run flagged 3 `react-hooks/refs` errors from the ref-sync pattern, which I fixed by switching to the keyed-remount pattern; second run clean).
- **`npx tsc --noEmit --skipLibCheck`**: **0 errors in my 2 files** (grep for `repairs-view|reports-view` returns empty).
- **Dev log**: only `✓ Compiled in NNN ms` entries after each file write. The pre-existing `Module not found: '@/components/views/home-view'` errors in `view-router.tsx` are unrelated to this task (home-view was never created by any prior agent). Zero `⨯` / `SyntaxError` / `ModuleParseError` referencing `repairs-view.tsx` or `reports-view.tsx`.
- **API contracts verified** (read-only, against existing routes): `/api/repairs?pageSize=200` returns `{ data: Repair[], total }` with full includes; `/api/repairs/[id]` PATCH supports `{ status, diagnosis, technicianId, laborCost, paid, notes }` and auto-recomputes `total`; `/api/repairs/[id]/parts` POST/PATCH/DELETE handle add/toggle-used/remove with stock deduction + IN movement reversal; `/api/reports?type=X` returns `{ type, rows, count }` and `?format=csv` returns text/csv.

### Stage Summary
Both views rewritten to embody the new "speed and minimal clicks" philosophy. Repairs is now a clean 6-column Kanban with one-click status changes, an inline New Ticket dialog, and a focused detail sheet (status dropdown + parts + cost summary + timeline). Reports is now a clean 6-card picker + preview table + 2 export buttons (PDF via print, Excel via CSV) — no report builder, no analytics bloat. Both views honor the emerald design system (NO indigo/blue), are fully responsive (mobile-first with horizontal-scroll kanban), have proper loading/empty/error states, and pass lint + tsc with 0 errors. No backend changes needed — the existing `/api/repairs*` and `/api/reports*` routes already support every operation the simplified views require.
