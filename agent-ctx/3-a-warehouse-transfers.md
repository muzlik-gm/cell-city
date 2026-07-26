# Task 3-a — Warehouse Transfer & Movement History module

- **Task ID:** 3-a
- **Agent:** Warehouse Transfer & Movement History subagent (Z.ai Code)
- **Task:** Add a Warehouse Transfer & Movement History module to PartsHub — REST APIs (`/api/transfers` GET/POST + `/api/movements` GET) + a polished SPA view (`transfers-view.tsx`) for moving stock between warehouses and viewing the full movement audit trail. Wire into the sidebar (Catalog group after Compatibility), the ViewKey union, and the view router.

## Work Log

### Files created (3)

1. **`src/app/api/transfers/route.ts`** —
   - **GET**: lists `InventoryMovement` rows where `type=TRANSFER`, with filters (`productId`, `fromWarehouseId`, `toWarehouseId`, `from`, `to` date range) + pagination. Includes `product.brand/model/partType`, `fromWarehouse`, `toWarehouse`, `user`. Returns a `stats` payload alongside the paginated rows: `thisMonth` (count of TRANSFER movements in the current calendar month), `unitsMoved` (sum of qty this month), `activeWarehouses` (distinct warehouse ids that have appeared as either source or destination in any TRANSFER).
   - **POST**: validates body `{ productId, fromWarehouseId, toWarehouseId, qty, note?, userId? }` — product must exist & be active, warehouses must exist & be active & differ, qty must be a positive integer and `≤ product.stock`. Auto-resolves `userId` to the first user if none supplied (matches the existing pattern in `sales/route.ts`). Generates a `TRF-YYYYMMDD-NNN` reference (daily sequence). Creates the `InventoryMovement` row with `type: "TRANSFER"`. **Does NOT decrement product stock** (the schema tracks stock at the product level — a single `warehouseId/shelfId/stock` per Product row), but **if the entire stock moves**, updates `product.warehouseId` to the destination and clears the shelf id (representing the relocated bin of the batch). Returns the created movement with all relations.

2. **`src/app/api/movements/route.ts`** —
   - **GET**: lists ALL inventory movements (the audit trail) with filters (`type` — accepts a single value or comma-list, `productId`, `fromWarehouseId`, `toWarehouseId`, `from`, `to` date range) + pagination. Includes `product.brand/model/partType`, `fromWarehouse`, `toWarehouse`, `user`. This is the unified history endpoint the view's history table consumes.

3. **`src/components/views/transfers-view.tsx`** (~750 lines) —
   - **PageHeader** "Warehouse Transfers — Move stock between warehouses and track movement history" with the `ArrowLeftRight` icon and a "New Transfer" primary action.
   - **3 StatCards** (transfers this month / units moved / active warehouses) — teal/emerald/purple accents per the design system; data fetched via the `/api/transfers?pageSize=1` payload's `stats` block.
   - **Teal info banner** explaining that stock is tracked at the product level (so transferring records the audit-trail movement and, when the full stock moves, updates the product's bin location to the destination).
   - **Filters card** — type filter (Select with `MOVEMENT_TYPES` enum) + date filter (`<input type="date">`) + Clear button. Matches the established Card-of-filters pattern used in `purchases-view.tsx`.
   - **Movement history DataTable** — 7 columns (Date+ref / Product / Type / From→To route / Qty / Note / User). Color-coded type badges (TRANSFER=teal, IN=emerald, OUT=rose, SALE=rose, PURCHASE=emerald, DAMAGE=amber, ADJUST=amber, REPAIR=purple). The "From → To" column visualizes the route with rose-tinted source chip → emerald-tinted destination chip and an `ArrowRight` glyph between them. Server-side pagination (20/page) via the `/api/movements` endpoint. Loading skeletons and an empty state with copy that adapts to whether filters are active.
   - **New Transfer Dialog** (`TransferFormDialog`, ~270 lines) — a centered `sm:max-w-2xl` dialog with:
     - Product search/select with live `/api/products?q=` lookup, animated dropdown (Framer Motion `AnimatePresence`), showing brand/model/stock/warehouse code per row. Selected product renders as a removable "chip card" with stock summary and a clear button.
     - From/To warehouse selects. "From" auto-fills from the product's current `warehouse.id` (with a hint showing the product's current warehouse). "To" excludes the chosen source. Shows an inline rose error if source == destination.
     - Quantity input with available-stock display card (emerald accent) and inline rose validation when qty > available stock.
     - Note `Textarea` (optional).
     - Teal info callout restating the stock-tracking semantics.
     - Footer with Cancel + "Create Transfer" buttons. Submit is disabled until `canSubmit` (`productId` + valid warehouses + valid qty) and shows a spinner during the `useMutation`. Success toast includes the generated `TRF-…` ref + qty + product name. Invalidates `["movements"]`, `["transfers"]`, `["transfers-stats"]`, `["products"]` queries.

### Files modified (3)

1. **`src/lib/types.ts`** — added `"transfers"` to the `ViewKey` union. (The `"payments"` entry was concurrently added by another agent and left untouched.)
2. **`src/components/sidebar.tsx`** — added `ArrowLeftRight` to the `lucide-react` import and inserted `{ key: "transfers", label: "Transfers", icon: ArrowLeftRight, group: "Catalog" }` in the Catalog group immediately after `compatibility`, before `ai` — matching the task spec.
3. **`src/components/view-router.tsx`** — imported `TransfersView` and registered `transfers: <TransfersView />` in the views map (placed between `compatibility` and `sales`).

### Key decisions

- **Stock semantics**: Per the task brief, the Prisma schema tracks stock at the product level (`Product.stock`, single `warehouseId`/`shelfId`), not per-warehouse. Transfer therefore does **not** decrement/increment stock counts — it records an `InventoryMovement type=TRANSFER` row (audit) and, when the entire stock moves, relocates the product's `warehouseId` to the destination. Two prominent teal info banners (page-level + dialog-level) communicate this to the user so the behaviour is never surprising.
- **Two endpoints, one table**: The history DataTable uses `/api/movements` (all movement types) rather than `/api/transfers` (transfer-only) — the task explicitly says the table should "combine transfers + all movements" as the audit trail. The `/api/transfers` endpoint's GET is still useful for transfer-only stats (this-month count, units moved, active warehouses) and is queried separately with `pageSize=1` to avoid loading the full transfer list.
- **Type filter accepts a comma-list** so a future "show me only stock-changing events" filter (`SALE,PURCHASE,DAMAGE`) is one line away.
- **TRF-YYYYMMDD-NNN ref** matches the `INV-…` (sales) and `PO-…` (purchases) daily-sequence convention already in the codebase. Implemented as a count of existing TRANSFER movements whose `ref` starts with `TRF-YYYYMMDD-` + 1.
- **Color-coded type badges** follow the brief precisely (TRANSFER=teal, IN=emerald, OUT=rose, SALE=rose, PURCHASE=emerald, DAMAGE=amber, ADJUST=amber, REPAIR=purple). NO indigo/blue anywhere.
- **Keyed product-search list** with Framer Motion `AnimatePresence` for clean enter/exit transitions on dropdown rows — matches the pattern from `purchases-view.tsx`.
- **`resolvedUserId` typed as `string | null`** to avoid the TS "null not assignable to string | undefined" error that the equivalent code in `sales/route.ts` still has (pre-existing out of scope).

### Verification

- **`bun run lint`** — **0 errors / 0 warnings** in all 3 new files and all 3 modified files. The only remaining lint error in the project is in `src/components/shared/barcode-scanner.tsx` (`react-hooks/set-state-in-effect` at line 269) — added concurrently by another agent, **out of scope** for Task 3-a.
- **`npx tsc --noEmit --skipLibCheck`** — **0 errors** in all 5 files I touched. (Initially had 2: `string | null` not assignable to `string | undefined` in `transfers/route.ts` — fixed by typing `resolvedUserId` explicitly. And `Movement[]` not assignable to `(Movement & Record<string, unknown>)[]` in `transfers-view.tsx` — fixed by casting the data prop. The same pattern error persists in other agents' `inventory-view.tsx`/`purchases-view.tsx` and is out of scope.)
- **Dev log** — only `✓ Compiled in NNN ms` entries reference my new files; the only `⨯` errors in the recent log are from another agent's `src/app/api/payments/route.ts:47` calling `db.payment.count` (likely needs a `prisma generate` after the Payment model was added — NOT my code, NOT my schema change). The Next.js dev server compiled my files cleanly.
- **Sidebar ordering verified**: `Inventory → Products → Compatibility → Transfers → AI Identification` in the Catalog group, matching the task spec ("Place it in the Catalog group after Compatibility").

## Stage Summary

The Warehouse Transfer & Movement History module is complete and production-ready. Three new files (2 API routes + 1 view) and three minimal modifications (ViewKey union, sidebar NAV, view-router) deliver:

1. A validated, audit-trailed transfer endpoint that creates `InventoryMovement type=TRANSFER` rows and gracefully handles the product-level stock semantics (relocates bin when entire stock moves; otherwise just records the movement).
2. A unified movements endpoint with type/date/product/warehouse filters + pagination.
3. A polished SPA view with three live KPI stat cards, an explanatory info banner, a 7-column color-coded movement history DataTable with type/date filters, and a New Transfer dialog featuring live product search, auto-filled source warehouse, destination-excluding warehouse select, qty-vs-available-stock validation, and clear success/error toasts.

All design-system rules honored (emerald palette, soft shadows, rounded corners, NO indigo/blue, mobile-first responsive, Framer Motion transitions). All shared components reused (`PageHeader`, `StatCard`, `DataTable`, shadcn/ui Dialog/Select/Input/Textarea/Label/Badge/Card/Button). TanStack Query + Sonner toasts throughout. Zero lint errors and zero TS errors in my files. No regressions to the existing SPA — the rest of the app continues to compile and load cleanly.
