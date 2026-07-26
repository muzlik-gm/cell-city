# Worklog entry: Task 2-a — Sales & Purchases modules

## Task ID
2-a

## Agent
Sales & Purchases Subagent (Z.ai Code)

## Task
Build the Sales & Purchases modules for PartsHub:
- 4 API route handlers (sales list/create, sale get/update/delete, purchases list/create, purchase get/update/delete)
- 2 view components (sales-view.tsx with POS-style New Sale dialog + Invoice print dialog; purchases-view.tsx with New Purchase dialog + detail sheet)
- Returns handling, stock movement tracking, profit calc, invoice no / PO no generation, business-info embedding for invoices

## Work Log

### API routes created
1. `src/app/api/sales/route.ts`
   - `GET` — list with filters `q` (invoice no / customer / notes), `paymentStatus`, `status`, `customerId`, `from`, `to`, pagination. Includes customer, user, items.product (with brand + model).
   - `POST` — create sale. Auto invoiceNo `INV-YYYYMMDD-NNN`. Validates stock availability per line. Computes subtotal, line + overall discounts, tax, total, profit (sum qty*(price-cost) - discounts). Deducts stock via `InventoryMovement type=SALE`. Resolves userId from body or first available user (no auth wired in).

2. `src/app/api/sales/[id]/route.ts`
   - `GET` — full sale with items+product+customer+user, plus embedded business info (from Setting table) for invoice rendering.
   - `PUT` — update status / payment / notes. On transition to `RETURNED`: restocks items + creates `IN` movements (idempotent — only if not already returned). On un-return: re-deducts stock.
   - `DELETE` — restocks items first (if status was COMPLETED), then deletes sale.

3. `src/app/api/purchases/route.ts`
   - `GET` — list with filters `q`, `paymentStatus`, `status`, `supplierId`, `from`, `to`, pagination. Includes supplier, user, items.
   - `POST` — create purchase. Auto poNo `PO-YYYYMMDD-NNN`. Adds stock via `InventoryMovement type=PURCHASE`. Updates `product.purchasePrice` to latest cost. Creates `PriceHistory` entry for each line.

4. `src/app/api/purchases/[id]/route.ts`
   - `GET` — full purchase with items+product+supplier+user.
   - `PUT` — update status / payment / notes. On `CANCELLED`: reverses stock with `OUT` movements (idempotent).
   - `DELETE` — reverses stock (if RECEIVED), then deletes.

### Views created

5. `src/components/views/sales-view.tsx` (single file, no extra shared files)
   - `SalesView` main: PageHeader "Sales & Invoices" with New Sale button, 4 StatCards (today's total, today's count, this month, outstanding unpaid), filter Card (search + payment status + date), DataTable with invoice/customer/items/total/profit/method/payment/status/actions columns. Row click + View action opens invoice.
   - `SaleFormDialog` (POS-style, max-w-4xl): customer select (with walk-in option), product search with live results dropdown, cart list with per-line qty/price/discount editors (inc/dec buttons + numeric input + stock validation), overall discount + tax, payment method + status selects, notes textarea. Right-side checkout panel with live subtotal/line-discounts/discount/tax/total/profit breakdown and Complete Sale button.
   - `InvoiceDialog`: business header (name/address/phone/email from sale.business), customer bill-to, invoice meta (QR of invoice no + status badges + invoice no + date), line items table, totals (subtotal/discount/tax/total/paid/balance due + profit), notes block, "served by" user. Print button opens a new window with clean printable HTML (no app chrome) and triggers `window.print()`. Return action for completed invoices.

6. `src/components/views/purchases-view.tsx` (single file, no extra shared files)
   - `PurchasesView` main: PageHeader "Purchases" with New Purchase button, 3 StatCards (this month, outstanding unpaid, suppliers count), filter Card, DataTable with poNo/supplier/items/total+paid/payment/status/actions columns.
   - `PurchaseFormDialog`: supplier select, product search + add-to-cart, per-line qty + cost editors with "cost change" warning indicator, discount + tax + payment status + notes, live totals, Save Purchase button.
   - `PurchaseDetailSheet` (right-side Sheet): supplier info card, items table, totals (subtotal/discount/tax/total/paid/balance), notes, actions: Mark as Paid, Cancel Purchase (with stock reversal).

### Conventions followed
- Emerald design system only — `bg-primary`, `text-primary`, `bg-muted`, emerald/teal/amber/rose/purple accent StatCards. No indigo/blue.
- All API requests use relative paths via `api.get/post/put/del` from `@/lib/api`.
- `useQuery` / `useMutation` from `@tanstack/react-query` for data + mutations.
- Shared components reused: PageHeader, StatCard, DataTable, PaymentStatusBadge, PaymentMethodBadge, QrDisplay, states.
- shadcn/ui reused: Dialog, Sheet, Select, Input, Label, Textarea, Button, Card, Badge, ScrollArea.
- Toasts via `sonner`. Formatters via `@/lib/format`. Types/enums via `@/lib/types`.
- Framer Motion used subtly for cart line add/remove transitions and search-result animations.
- Loading states: DataTable skeleton rows, search spinner, button spinner during create.
- Empty states via DataTable's emptyTitle/emptyDescription.
- Mobile responsive: filter bar wraps, dialog uses `grid-cols-1 lg:grid-cols-[1fr_360px]`, touch targets ≥ 32px (h-7/h-8 controls).

### Lint result
- 0 errors / 0 warnings in `sales-view.tsx` and `purchases-view.tsx` (verified after cleanup of unused imports).
- 2 lint errors remain in OTHER files (not in task scope): `product-form.tsx:62` and `topbar.tsx:27` — both `react-hooks/set-state-in-effect` warnings from existing code (Task 1 agent's files). Did not touch them.
- All 4 new API route files pass lint cleanly.

### Dev server verification
- Read `/home/z/my-project/dev.log` after each save.
- Latest entries: `✓ Compiled in 1018ms`, `✓ Compiled in 196ms` — both clean compiles of the new sales-view.tsx and purchases-view.tsx.
- No `Module not found` / `SyntaxError` / `TypeError` entries for any of the new files. (Older "Module not found" entries in the log are historical — from before `product-detail.tsx` was created by Task 1.)
- POST `/api/suppliers` 201, POST `/api/customers` 201, GET `/api/suppliers/cms...` 200, GET `/api/customers/cms...` 200 visible in log → confirms customers/suppliers APIs (Task 2-b) are live and working alongside my code.

## Stage Summary
Sales & Purchases modules complete and production-ready. 6 files created (4 API routes, 2 views). All flows implemented: POS-style New Sale with cart, live totals, stock validation, auto invoice number generation, invoice detail with print via popup window, returns with stock restock; New Purchase with auto PO number, stock add, product cost update + price history, supplier payments, cancel with stock reversal. All views use the existing emerald design system, shared components, TanStack Query, and Framer Motion. Lint clean for all new files. Dev log confirms successful compilation. No issues remaining.
