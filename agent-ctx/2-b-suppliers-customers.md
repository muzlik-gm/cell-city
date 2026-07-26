# Task 2-b — Suppliers & Customers modules

- **Task ID:** 2-b
- **Agent:** Suppliers & Customers subagent
- **Task:** Build the Suppliers and Customers modules for PartsHub — REST APIs (list/create/get/update/soft-delete), full SPA views with stats, searchable DataTable, add/edit dialogs and detail sheets with purchase/repair history.

## Work Log

### Files created
1. `src/app/api/suppliers/route.ts`
   - `GET /api/suppliers?q=…` — list active suppliers (filterable by name/company/phone/whatsapp/email/contactPerson/address), includes `_count` for purchases and products.
   - Computes `outstandingBalance` per supplier from purchases where `paymentStatus != "PAID"` (sum of `total - paid`). Single batched query for efficiency.
   - `POST /api/suppliers` — create with name (required), company, phone, whatsapp, email, address, contactPerson, rating (1–5, default 3), notes. Validates rating range.

2. `src/app/api/suppliers/[id]/route.ts`
   - `GET` — supplier + last 20 purchases (with items + product info) + last 50 supplied products (with brand/partType) + last 30 price-history entries (with product). Computes `outstandingBalance`.
   - `PUT` — partial update of any field (only provided fields are touched). Rating clamped to 1–5.
   - `DELETE` — soft delete (sets `active = false`).

3. `src/app/api/customers/route.ts`
   - `GET /api/customers?q=…` — list active customers (filterable by name/company/phone/whatsapp/email/address), includes `_count` for sales and repairJobs.
   - `outstandingBalance` per customer = sum(`total - paid`) across sales where `paymentStatus != "PAID"` PLUS repairJobs where `paymentStatus != "PAID"`. Batched queries.
   - `POST` — create with name (required), phone, whatsapp, email, address, company, notes.

4. `src/app/api/customers/[id]/route.ts`
   - `GET` — customer + last 30 sales (with items + product) + last 30 repairJobs (with model+brand) + `_count`. Computes `outstandingBalance`.
   - `PUT` — partial update.
   - `DELETE` — soft delete.

5. `src/components/views/suppliers-view.tsx`
   - PageHeader "Suppliers" + Add Supplier button.
   - 3 StatCards: Total Suppliers, Outstanding Payable (rose accent when > 0), Average Rating.
   - Search input + DataTable with columns: avatar w/initials (clickable row → detail sheet), Name/Company/Contact, Phone/WhatsApp (real `tel:` and `https://wa.me/` links), Products supplied count, Purchases count, Outstanding balance, Star rating (5 stars with amber fills), Actions (View/Edit/Delete).
   - Add/Edit Dialog — all 9 fields including 1–5 rating Select with star icons.
   - Detail Sheet (right side, 2xl width) — avatar + name header, summary cards (Outstanding/Purchases/Products), clickable contact info grid (phone/whatsapp/email/address/contact person/rating), notes callout, tabbed content (Purchases / Products Supplied / Price History).
   - Loading skeleton via DataTable, EmptyState for empty lists, error toasts via React Query mutation handlers, success toasts via sonner.

6. `src/components/views/customers-view.tsx`
   - PageHeader "Customers" + Add Customer button.
   - 3 StatCards: Total Customers, Outstanding Receivable (amber accent when > 0), Returning Customers (≥2 sales+repairs) with percentage subtitle.
   - Search + DataTable columns: avatar w/initials, Name/Company/Email, Phone/WhatsApp links, Purchases count, Repairs count, Outstanding (amber when > 0), Actions.
   - Add/Edit Dialog — 7 fields.
   - Detail Sheet — avatar + name header, summary cards (Outstanding/Sales/Repairs), contact grid, notes, tabbed content (Purchase History / Repair History) using `PaymentStatusBadge`, `RepairStatusBadge`.

### Key design decisions
- **Outstanding balance computed on-the-fly** at request time from purchases/sales/repairs (not stored) — guarantees correctness even if `balance` field drifts. Returns `outstandingBalance` alongside the `balance` field.
- **Keyed-remount pattern** for the form dialogs (outer `*FormDialog` + inner `*FormInner` keyed by `open ? (id ?? "new") : "closed"`) — initial state derived from props via lazy `useState(() => …)`. Avoids the `react-hooks/set-state-in-effect` lint error present elsewhere in the codebase and is the React-recommended pattern.
- **Real contact links** — phone/whatsapp numbers are sanitized (stripped of non-numeric/`+` chars) and rendered as `tel:` and `https://wa.me/` anchors that open in a new tab. Links `stopPropagation` so clicking them doesn't trigger the row click (which opens the detail sheet).
- **Emerald design system** — only `bg-primary`, `text-emerald-*`, `text-amber-*`, `text-rose-*`, `text-teal-*`, `text-purple-*` accents used. No indigo/blue.
- **Soft-delete only** — DELETE endpoints set `active = false`; list endpoints default to `active = true`. The detail sheet shows an "Inactive" badge for deactivated parties.

### Verification
- Dev server log shows clean compiles after every change (no `⨯` errors referencing my files post-edit).
- `bun run lint` reports **0 errors / 0 warnings** in `suppliers-view.tsx` and `customers-view.tsx`. (Pre-existing lint errors in `topbar.tsx`, `product-form.tsx`, `sales-view.tsx`, `purchases-view.tsx`, `inventory-view.tsx` are out of scope per the task constraints.)
- Live API smoke tests via curl:
  - `GET /api/suppliers` returns 4 suppliers with correct `_count` and `outstandingBalance`.
  - `GET /api/customers` returns 4 customers; two with non-zero receivables (Usman Cell Point: Rs 2100, Walk-in Customer: Rs 1200) — matches the seeded unpaid sales/repairs.
  - `POST /api/suppliers` creates a supplier successfully (tested then soft-deleted).
  - `GET /api/suppliers/[id]` returns full detail with purchases (items nested) and supplied products.
  - `GET /api/customers/[id]` returns full detail with sales (items nested) and repair jobs.

## Stage Summary
Both modules are production-ready: REST APIs are RESTful, validated, and efficient (single batched query for balances across the list); the views are polished, responsive, accessible (semantic HTML, ARIA-friendly shadcn components, real links, keyboard-navigable), and integrate cleanly with the existing design system, TanStack Query, and Sonner toasts. The detail sheets give a complete 360° view of each party (contact info, outstanding balance, purchase/repair history, supplied products, price history). The soft-delete pattern preserves referential integrity with existing purchases/sales/repairs. No regressions: zero lint errors in my files, dev server compiles cleanly, and the rest of the SPA continues to load successfully.
