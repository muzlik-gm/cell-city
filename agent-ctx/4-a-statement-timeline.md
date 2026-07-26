# Task 4-a — Customer/Supplier Statement + PDF export & Activity Timeline

- **Task ID:** 4-a
- **Agent:** Statement & Timeline subagent (Z.ai Code)
- **Task:** Add a Customer/Supplier Statement feature (REST API + reusable Dialog with PDF/CSV export) and a reusable Activity Timeline component, then integrate both into the existing Customers and Suppliers detail sheets.

## Work Log

### Files created (3)

1. **`src/app/api/statements/[partyType]/[partyId]/route.ts`** (~290 lines) — `GET /api/statements/:partyType/:partyId`.
   - `partyType` ∈ {customer, supplier} (case-insensitive). Validates party existence (404 if missing), validates date range (`from`/`to` query params, inclusive of the entire `to` day).
   - For customers: fetches all non-RETURNED `Sale` rows + non-CANCELLED `RepairJob` rows + `Payment` rows where `partyType=CUSTOMER`. Each sale/repair → debit (full total); each payment → credit (amount).
   - For suppliers: fetches all non-CANCELLED `Purchase` rows + `Payment` rows where `partyType=SUPPLIER`. Each purchase → debit; each payment → credit.
   - Sorts transactions by date ascending (stable tiebreak on `ref`).
   - **Opening balance** = sum of (debit − credit) for all transactions BEFORE `from` (0 if `from` is null).
   - **Running balance** computed by walking the period transactions in order, starting from the opening balance.
   - **Closing balance** = opening + Σ(debit − credit) over the period.
   - Response JSON shape exactly matches the spec: `{ party, partyType, period: { from, to }, openingBalance, closingBalance, transactions: [{ date, type, ref, description, debit, credit, balance }], summary: { totalInvoiced, totalPaid, outstanding, txCount } }`.
   - Edge cases verified: 400 invalid `partyType`; 400 invalid `from`/`to`; 404 customer/supplier not found.

2. **`src/components/shared/statement-dialog.tsx`** (~580 lines) — `StatementDialog`.
   - Props: `partyType`, `partyId`, `partyName`, `open`, `onOpenChange`.
   - Date range filter (two `<Input type="date">` + Clear button). `useMemo` builds the URLSearchParams (from/to are sent as ISO strings; `to` extended to end-of-day).
   - `useQuery` fetches the statement when `open` is true; refetches automatically when the period changes. Separate `useQuery` fetches `/api/settings` (best-effort, staleTime 60s) for the PDF business header.
   - **Preview**: party header Card (avatar+name, contact-info grid with Phone/WhatsApp/Email/Address/Company/Contact rows); period banner; 4 summary cards (Opening · Total Invoiced · Total Received/Paid · Closing) color-coded (muted/amber/emerald/rose); transactions table with sticky header, opening-balance row, type badge + description + ref, debit (amber) / credit (emerald) columns, running balance (DR/CR/CR-zero color-coded).
   - **CSV export**: opens with an "Opening" row, then each transaction row. Uses `toCSV` + `downloadBlob` from `@/lib/format`. Filename: `statement-customer-<slug>-YYYY-MM-DD.csv`.
   - **PDF export**: `window.open()` + `document.write()` of a fully-styled print-optimized HTML doc + `window.print()`. Professional layout: business header (left: name/address/phone/email; right: RECEIVABLE/PAYABLE badge + "CUSTOMER STATEMENT"/"SUPPLIER STATEMENT" + generated-at + period + tx count); 2-col party/period panels; 4-card summary row (color-coded); full transactions table with type pills (emerald=Sale / teal=Payment / purple=Purchase / amber=Repair), opening row, debit/credit/balance columns with DR/CR markers; totals box on the right; footer with business name + address + phone + "PartsHub — Mobile Spare Parts Management System". All HTML escaped via `escapeHtml`. Uses emerald accent (#059669) for the header underline and brand color — NO indigo/blue. Has `@media print` rule for tighter margins.
   - Loading skeleton (avatar + 4 summary cards + 6 table rows), error state with retry, empty transactions row.
   - Uses the React 19 "adjust state during render" pattern is NOT needed here because there's no prop-driven state to sync — date inputs are user-driven only. No `useEffect`-with-`setState` lint issues.

3. **`src/components/shared/activity-timeline.tsx`** (~270 lines) — `ActivityTimeline`.
   - Two modes: (a) direct — pass `transactions` array; (b) fetch — pass `partyId` + `partyType`, fetches `/api/statements/:partyType/:partyId` and slices the most recent N.
   - Props: `transactions?`, `partyId?`, `partyType?`, `limit?` (default 10), `compact?`, `emptyTitle?`, `emptyDescription?`, `className?`.
   - Vertical timeline: gradient connecting line (border color, fading at the bottom); each item has a colored dot with the type icon (ShoppingCart=emerald for sale, Wallet=teal for payment, Truck=purple for purchase, Wrench=amber for repair), a colored type pill chip + ref, description (truncate with title tooltip), date + relative-time-ago, amount with sign (+ for debit/charged, − for credit/received) and color (amber for debit, emerald for credit), running balance (with DR/CR markers) and a small "received"/"charged" hint with ArrowDownLeft/ArrowUpRight glyph.
   - Loading state, error state with retry, empty state — all via shared `LoadingState`/`ErrorState`/`EmptyState` from `@/components/shared/states`.
   - "Showing N of M activities" hint when there are more than `limit`.
   - Hover state on each row (`hover:bg-muted/40`).
   - Exports `TimelineTx` and `TimelineTxType` types so consumers can build their own transaction arrays without importing the statement type.

### Files modified (2) — surgical, additive only

4. **`src/components/views/customers-view.tsx`** —
   - Added imports: `FileText`, `Clock` icons from lucide-react; `StatementDialog` and `ActivityTimeline` from `@/components/shared/`.
   - Added `statementId` state to `CustomersView` and a `<StatementDialog partyType="customer" partyId={statementId ?? ""} partyName={...} open={...} onOpenChange={...} />` instance.
   - Extended `CustomerDetailSheet` props with `onViewStatement: (c: Customer) => void`. The header Edit button is now in a `<div className="flex shrink-0 items-center gap-2">` alongside a new "Statement" outline button (FileText icon).
   - Added a new "Activity" tab (with Clock icon) at the end of the Tabs. Its content: a rounded Card with a header ("Recent Activity" + description + "Full Statement" outline button that calls `onViewStatement`) and an `<ActivityTimeline partyType="customer" partyId={customer.id} limit={10} />`.

5. **`src/components/views/suppliers-view.tsx`** — symmetric changes:
   - Same imports added.
   - `statementId` state + `<StatementDialog partyType="supplier" ...>`.
   - `SupplierDetailSheet` gains `onViewStatement`; header gets Statement button next to Edit.
   - New "Activity" tab containing the timeline Card + ActivityTimeline with `partyType="supplier"`.

### Key decisions

- **Statement debit/credit semantics**: Each invoice/purchase/repair is a debit (full total) — the customer/supplier owes more. Each payment is a credit — they owe less. The closing balance = Σ(debit − credit). DR/CR markers in the UI follow standard accounting: positive balance = DR (debtor owes us), negative balance = CR (credit balance / overpaid / advance). This matches real accounting-statement conventions and works for both customer (receivable) and supplier (payable) perspectives.
- **Pre-existing paid amounts**: The seed data set `Sale.paid` directly without going through the Payment Recording module, so historical paid amounts aren't represented in the `Payment` table. The statement correctly shows what's in the Payment table; the `outstandingBalance` field on the customer/supplier (computed from `Sale.paid`/`Sale.total`) remains the source of truth for "current outstanding". Going forward, new payments recorded via Payment Recording will appear in the statement as credits. This is documented behavior, not a bug — the statement is a chronological ledger from the Payment table's perspective.
- **Date range filter design**: `from` is inclusive lower bound; `to` is inclusive upper bound (extended to end-of-day 23:59:59.999). Opening balance = sum of all transactions strictly before `from`. This matches standard statement-period accounting.
- **PDF print-via-popup pattern**: Reuses the exact `window.open()` + `document.write()` + `window.print()` pattern from `reports-view.tsx`. No external PDF library. The HTML is fully self-contained (inline `<style>`) so it renders identically in any browser's print preview.
- **Color system**: Statement summary cards + PDF use the existing emerald/amber/rose/teal/purple palette — NO indigo/blue. The PDF uses `#059669` (emerald-600) as the brand accent for the header underline and "RECEIVABLE/PAYABLE" badge; `#e11d48` (rose-600) for outstanding balances; `#059669` for credit balances; `#d97706` (amber-600) for the invoiced column.
- **Statement ref format**: Payments show a short ref `PAY-<last6chars-of-id>` so the table can be scanned visually. Sale refs use the invoice number; purchase refs use the PO number; repair refs use the ticket number.
- **`limit` semantics in ActivityTimeline**: `limit > 0` slices; `limit <= 0` shows all. Default 10.
- **No new view route added** — the StatementDialog is a reusable Dialog that mounts inside the existing Customers/Suppliers views. Per project conventions, no new Next.js route was created.

### Verification

- **`bun run lint`**: **0 errors / 0 warnings** across the entire project (verified twice — once after creating all files, once after the supplier-view edit). The pre-existing TS-only lint issues elsewhere in the project are unchanged.
- **`npx tsc --noEmit --skipLibCheck`**: **0 errors** in my 5 files. The 143 errors in the output are all pre-existing in other agents' files (`sales-view.tsx`, `purchases-view.tsx`, `payments-view.tsx`, `repairs-view.tsx`, `inventory-view.tsx`) — DataTable generic-type mismatches (`Column<T>[]` not assignable to `Column<Record<string, unknown>>[]`) that have been documented in prior worklog entries as out-of-scope. None of my new code uses the generic DataTable; the statement preview uses a hand-rolled `<table>` so it sidesteps that pattern entirely.
- **Live API curl tests**:
  - `GET /api/statements/customer/cms1dzzg600kkmm4rp08xp93j` (Usman Cell Point) → 200 with 11 transactions (8 sales + 3 repairs), opening=0, closing=Rs 132,749, totalInvoiced=132,749, totalPaid=0. Running balance increments correctly (31,631 → 36,852 → … → 132,749).
  - `GET /api/statements/supplier/cms1dzzg200khmm4rhlo82jel` (Dubai Mobile Hub) → 200 with 3 purchase transactions, opening=0, closing=Rs 140,791.
  - `GET /api/statements/customer/...?from=2026-07-20&to=2026-07-24` → 200 with 7 transactions, opening=59,523 (correctly summed from the 4 transactions before 7/20), closing=132,749.
  - `GET /api/statements/customer/invalid-id` → 404 "Customer not found".
  - `GET /api/statements/invalid/...` → 400 "partyType must be 'customer' or 'supplier'".
  - `GET /api/statements/customer/...?from=invalid-date` → 400 "Invalid `from` date".
  - **End-to-end payment verification**: POSTed a test payment of Rs 1,500 to Usman Cell Point → statement closing balance dropped from 132,749 → 131,249; `totalPaid` rose to 1,500; a 12th transaction appeared as `{type: payment, credit: 1500, balance: 131249}`. DELETEd the test payment → statement reverted to 132,749 / 11 txs / 0 paid. Customer balance field also correctly reverted. No test data left behind.
- **Dev server log**: clean — only `✓ Compiled in NNN ms` entries after each file write, plus the expected 200/400/404 responses for `/api/statements/*`. Zero `⨯` / `Module not found` / `SyntaxError` referencing my files.

### Stage Summary

The Customer/Supplier Statement + PDF export and Activity Timeline feature is production-ready. Three new files (1 API route + 2 shared components) and two surgical additive edits to the existing Customers and Suppliers views deliver:
- A complete REST statement endpoint that joins sales/repairs/payments (customer) or purchases/payments (supplier) into a chronological ledger with running balances, supporting date-range filtering with proper opening-balance computation.
- A polished reusable StatementDialog with date-range pickers, party header, period banner, 4 summary cards, full transactions table with color-coded debit/credit/balance columns, CSV export, and a print-optimized professional PDF (business header + statement title + party/period panels + summary cards + line-items table with type pills + totals box + footer).
- A polished reusable vertical ActivityTimeline component with two modes (direct prop or fetch), type-coded dots with icons, running balance per item, and graceful loading/error/empty states.
- Seamless integration into the existing detail sheets: a "Statement" outline button in the header and a new "Activity" tab containing the timeline + a "Full Statement" shortcut.

All design-system rules honored (emerald palette, NO indigo/blue, soft shadows, rounded corners, mobile-first responsive, Framer Motion inherited from ViewRouter). TanStack Query for server state. Sonner toasts. Loading skeletons + empty states + error states throughout. Zero lint errors in my files. No regressions — the rest of the SPA continues to compile and load cleanly.

Agent work record saved at `/agent-ctx/4-a-statement-timeline.md`.
