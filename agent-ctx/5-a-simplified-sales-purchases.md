# Task 5-a — Simplified Sales & Purchases views (single-screen POS)

- **Task ID:** 5-a
- **Agent:** Simplified POS subagent (Z.ai Code)
- **Date:** 2026-07-25
- **Files rewritten:** `src/components/views/sales-view.tsx`, `src/components/views/purchases-view.tsx`

## What changed

Both views were fully rewritten to honor the new design philosophy: **speed and minimal clicks — like Google Search, not SAP.**

### `sales-view.tsx` (959 → 961 lines)

- Removed the **New Sale Dialog** entirely — the POS *is* the view now.
- Removed the filters Card, the DataTable of historical sales, the stats pagination, and the `SaleFormDialog`.
- New layout (single screen):
  1. `PageHeader` ("Sales & Checkout")
  2. Compact 4-card KPI strip (Today / This Month / Outstanding / Cart Items)
  3. POS Card — `lg:grid-cols-[1fr_380px]`:
     - **Left**: large `h-11` search input (instant `/products?q=`, clearable, scanner button beside), `max-h-72` results dropdown, then cart header (count + Clear), then `ScrollArea` cart with Framer-Motion-animated line cards (qty stepper / editable price / editable discount / live line total / remove). Stock-overflow warning per line.
     - **Right**: checkout panel — Customer select, **big 4-button payment-method group** (Cash/Card/Bank/Mobile with Lucide icons), **3-button payment-status segmented** (Paid=emerald / Partial=amber / Unpaid=rose), conditional Amount Paid input (PARTIAL only), Discount + Tax, optional Notes, live totals block with `tabular-nums`, big `h-12` "Complete Sale · Rs X" button.
     - On `<lg` the right panel becomes a slide-over triggered by a sticky "Checkout · Rs X" button bar so the cart stays scannable on phones.
  4. **Recent Sales card** — last 5 sales, divider list, click → opens `InvoiceDialog` (retained).
- On success: toast → `clearCart()` → invoice dialog auto-opens (print or return immediately).
- State-sync during render (not in `useEffect`) keeps `amountPaid` in sync when status flips to PAID — passes `react-hooks/set-state-in-effect`.

### `purchases-view.tsx` (765 → 738 lines)

- Removed the **New Purchase Dialog** entirely — the receive flow *is* the view.
- Removed the filters Card, the DataTable, the `PurchaseFormDialog`.
- New layout (single screen, mirrors the sales POS):
  1. `PageHeader` ("Receive Stock")
  2. Compact 4-card KPI strip (This Month / Outstanding / Suppliers / Receiving)
  3. POS Card — `lg:grid-cols-[1fr_380px]`:
     - **Left**: large search input (instant `/products?q=`), results dropdown, then receiving list header (count + Clear), then `ScrollArea` of line cards (qty stepper / editable unit cost / live line total / remove). Amber "Cost change: was X → now Y" hint when cost changes.
     - **Right**: **big `h-12` Supplier select** (prominent), payment-status segmented (defaults UNPAID), Discount + Tax, optional Notes, live totals, big `h-12` "Receive Stock · Rs X" button.
     - Same slide-over-on-mobile pattern as Sales.
  4. **Recent Purchases card** — last 5, click → opens `PurchaseDetailSheet` (retained, with mark-as-paid + cancel actions).
- On success: toast → `clearAll()` → slide-over closes.

## Design rules honored
- Emerald design system (with rose/amber/teal/purple StatCard accents). NO indigo/blue.
- Large touch targets: `h-11` search input, `h-12` buttons & supplier select, `h-8` qty steppers, `p-3` payment-method buttons.
- `tabular-nums` on every total to prevent digit jitter.
- Framer Motion `AnimatePresence` on cart/receiving list for smooth add/remove.
- Loading skeletons via `LoadingState`, empty states via `EmptyState`, error toasts via `sonner`.
- Responsive: `grid-cols-1 lg:grid-cols-[1fr_380px]`, mobile slide-over checkout/receive panel.

## APIs used (no changes)
- `GET /api/products?q=` — instant product search
- `GET /api/customers`, `GET /api/suppliers` — party dropdowns
- `GET /api/sales?pageSize=5`, `GET /api/purchases?pageSize=5` — recent lists
- `GET /api/sales?pageSize=100`, `GET /api/purchases?pageSize=100` — stats aggregates
- `POST /api/sales`, `POST /api/purchases` — create
- `GET /api/sales/[id]`, `GET /api/purchases/[id]` — open detail
- `PUT /api/sales/[id]`, `PUT /api/purchases/[id]` — return / cancel / mark-paid

## Verification
- `npx eslint src/components/views/sales-view.tsx src/components/views/purchases-view.tsx` → **0 errors / 0 warnings**.
- `npx tsc --noEmit --skipLibCheck | grep -E "sales-view|purchases-view"` → **empty** (no TS errors).
- `bun run lint` (project-wide) → only 1 pre-existing error in `repairs-view.tsx` (different agent's file, out of scope).
- Dev server (`/home/z/my-project/dev.log`) → 8 consecutive `✓ Compiled in NNN ms` entries after the writes, no `⨯` errors referencing my files. Only stale `home-view` Turbopack HMR cache noise (pre-existing, recovered on next compile).

## Issues / follow-ups
- None for my scope. The new views are drop-in replacements; `view-router.tsx` imports `SalesView` and `PurchasesView` unchanged.
- The pre-existing `repairs-view.tsx` lint error (`react-hooks/set-state-in-effect` at line 663) is in another agent's file and was not touched.
- The stale Turbopack `home-view` Module-not-found cache noise is pre-existing (mentioned in CRON-REVIEW-2) and resolves on the next compile; not caused by my changes.
EOF
echo "Agent record written"; wc -l /home/z/my-project/agent-ctx/5-a-simplified-sales-purchases.md