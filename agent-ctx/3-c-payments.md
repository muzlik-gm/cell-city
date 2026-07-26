# Task 3-c — Payment Recording module

- **Task ID:** 3-c
- **Agent:** Payment Recording subagent (Z.ai Code)
- **Date:** 2026-07-26
- **Status:** ✅ Complete

## Task
Build the Payment Recording module for PartsHub — a new `Payment` Prisma model tracking individual payment transactions against customer/supplier outstanding balances, 2 REST API route handlers (POST/GET list + GET/DELETE by id) with linked sale/purchase paid-status syncing and party balance updates, and a polished SPA view with Customer/Supplier tabs, monthly + outstanding stats, a Record Payment dialog with "pay full" quick-fill, and a filterable history table.

## Files touched (7 + 1 lib)

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | modified | Added `Payment` model (id, partyType, partyId, saleId?, purchaseId?, amount, method, note, date; indexes on [partyType, partyId] and [date]) |
| `src/lib/db.ts` | modified | Added staleness guard so a cached `globalThis.prisma` missing newer models (e.g. `payment`) is dropped and replaced with a fresh `PrismaClient`. Production-safe. |
| `src/app/api/payments/route.ts` | new (~210 lines) | GET list (filters + enrichment) + POST create (transactional: payment + sale/purchase paid + party balance) |
| `src/app/api/payments/[id]/route.ts` | new (~100 lines) | GET single (enriched) + DELETE (transactional reversal) |
| `src/lib/types.ts` | modified | Added `"payments"` to `ViewKey` union |
| `src/components/sidebar.tsx` | modified | Imported `Wallet`; added payments nav item in Commerce group after Customers |
| `src/components/view-router.tsx` | modified | Imported + registered `PaymentsView` |
| `src/components/views/payments-view.tsx` | new (~810 lines) | Full Payments view: tabs, stats, filter card, history DataTable, Record Payment dialog |

## API contract

### `GET /api/payments`
Query params: `partyType` (CUSTOMER|SUPPLIER), `partyId`, `method`, `from`, `to`, `q`, `page`, `pageSize` (max 200).
Returns: `{ data: Payment[], total, page, pageSize }` where each Payment is enriched with `partyName`, `partySub`, `invoiceNo`, `poNo`.

### `POST /api/payments`
Body: `{ partyType, partyId, saleId?, purchaseId?, amount, method, note }`.
Validation: partyType ∈ {CUSTOMER, SUPPLIER}; partyId required; amount > 0; method ∈ {CASH, CARD, BANK, MOBILE, CREDIT}; rejects saleId+purchaseId combo; rejects cross-type links (customer→purchase, supplier→sale); verifies linked sale/purchase belongs to the party.
Side-effects (in `db.$transaction`): create Payment → if saleId, increment `sale.paid` + recompute `paymentStatus` → if purchaseId, same for purchase → decrement `customer.balance` / `supplier.balance`.
Returns: 201 with the created Payment.

### `GET /api/payments/:id`
Returns: single Payment with enriched party info + embedded `sale`/`purchase` summary objects (or `null`).

### `DELETE /api/payments/:id`
Reverses the payment in `db.$transaction`: if saleId, decrement `sale.paid` (clamped ≥0) + recompute status; if purchaseId, same for purchase; increment `customer.balance`/`supplier.balance` by amount; delete Payment row.
Returns: 204.

## paymentStatus recompute rule
- `PAID` if `paid >= total && total > 0`
- `UNPAID` if `paid <= 0`
- `PARTIAL` otherwise

Same rule in POST and DELETE for symmetry.

## Key design decisions
1. **Stale-prisma guard in `lib/db.ts`** — the dev server caches `PrismaClient` in `globalThis` and never re-instantiates across HMRs. After `prisma generate` adds the new `Payment` model, the cached client is missing `db.payment`. The guard detects this and forces a fresh client. Minimal, surgical, production-safe.
2. **Transactional payment application** — POST and DELETE wrap multi-step side-effects in `db.$transaction` so the books stay consistent on partial failure.
3. **`q` filter applied client-side** — Payment has no free-text column besides `note`; `q` filters on enriched (post-join) fields (note, partyName, invoiceNo, poNo). Avoids complex Prisma `OR` across relations.
4. **Linked-doc validation** — POST defensively rejects: customer→purchase, supplier→sale, doc not belonging to party, both saleId+purchaseId. UI bugs can't corrupt the ledger.
5. **"Pay full" smart context** — uses linked-doc outstanding when one is selected, else party's overall `outstandingBalance`. One-click exact-amount fill.
6. **Reuse existing endpoints** — party selection via `GET /api/customers` and `/api/suppliers`; outstanding-doc loading via `GET /api/sales?customerId=&paymentStatus=PARTIAL|UNPAID` and `/api/purchases?supplierId=&paymentStatus=...`. Zero new endpoints beyond `/api/payments`.
7. **React 19 "adjust state when props change" pattern** in the Record Payment dialog — no `useEffect` with `setState` (tracks `lastSeenOpen`/`lastSeenDefaultPartyType`/`lastSeenPartyType`). Satisfies strict `react-hooks/set-state-in-effect` lint rule.

## Verification

### Lint
`bun run lint` → **0 errors / 0 warnings** in all 7 of my files. (Project-wide also clean.)

### Live API tests (curl)
| Test | Result |
|---|---|
| GET /api/payments?partyType=CUSTOMER | 200, `{ data: [], total: 0 }` |
| POST (no linked doc, amount 500) | 201; Customer.balance 0 → -500 ✓ |
| POST (linked saleId, 5000, BANK) | 201; Sale.paid 50000 → 55000, status PARTIAL ✓ |
| POST (linked saleId, 5376, CASH — final settlement) | 201; Sale.paid → 60376, status PAID ✓ |
| DELETE (linked sale) | 204; Sale.paid → 55000, status PAID → PARTIAL ✓; Customer.balance reversed ✓ |
| GET /api/payments/:id | 200 with enriched partyName + embedded sale summary |
| Validation: invalid partyType | 400 "partyType must be CUSTOMER or SUPPLIER" |
| Validation: missing partyId | 400 "partyId is required" |
| Validation: negative amount | 400 "amount must be a positive number" |
| Validation: non-existent customer | 404 "Customer not found" |
| Validation: missing amount | 400 "amount must be a positive number" |
| Filter: date range + method | 200 with correct 0 results |
| All test data cleaned up | ✓ Sale restored to original PAID; all test payments deleted; customer balance back to 0 |

### SPA index
`GET /` → 200 HTML containing the rendered `<button>Payments</button>` nav item with `lucide-wallet` icon. View is registered in `view-router.tsx` and renders when the nav item is clicked.

### Dev server log
Clean — only `✓ Compiled` messages and `200`/`201`/`204` responses for `/api/payments*` and dependent endpoints. Zero `⨯` errors referencing my files.

## Issues
None. All required functionality delivered, lint clean, runtime verified end-to-end.
