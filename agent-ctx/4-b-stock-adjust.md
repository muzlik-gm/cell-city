# Task 4-b — Stock Adjustment Dialog + Quick Restock

**Task ID:** 4-b
**Agent:** Stock Adjustment subagent (Z.ai Code)

## Task
Add a Stock Adjustment dialog (with reason tracking) and a Quick Restock feature to PartsHub.
- New POST endpoint `/api/products/[id]/adjust` for IN/OUT/ADJUST with reason + optional price update.
- New reusable `StockAdjustDialog` shared component with 3 modes, contextual reasons, live preview, optional price update (IN only).
- New reusable `QuickRestockButton` shared component that opens the dialog directly in "Add Stock" mode.
- Surgical integration into `ProductDetailSheet` (header button) and `InventoryView` (table actions column).

## Files Created (3)
1. `src/app/api/products/[id]/adjust/route.ts` — POST endpoint
2. `src/components/shared/stock-adjust-dialog.tsx` — Reusable dialog
3. `src/components/shared/quick-restock-button.tsx` — Reusable trigger button

## Files Modified (2)
4. `src/components/shared/product-detail.tsx` — Added "Adjust Stock" button next to Edit in sheet header; renders StockAdjustDialog inside the sheet (with `qc.invalidateQueries(["product", p.id])` on close to refresh the detail's useQuery).
5. `src/components/views/inventory-view.tsx` — Added `QuickRestockButton` to the actions column (between View and Edit). Wrapped the actions div in `onClick={(e) => e.stopPropagation()}` so quick-action clicks don't trigger row click → detail sheet.

## API Endpoint Behaviour
Body: `{ type, qty, reason, note?, newPurchasePrice?, newSellingPrice?, userId? }`
- `type=IN`     → `stock += qty`, movement type=IN; optional price update + PriceHistory row if either new price provided.
- `type=OUT`    → `stock -= qty` (validates not below 0; 400 if insufficient), movement type=OUT.
- `type=ADJUST` → `stock := qty` (absolute correction), movement type=ADJUST with note `[reason] old → new`. `movementQty = abs(new - old)`.
- Reason enum validated against: RESTOCK, FOUND, LOST, DAMAGED, COUNT_CORRECTION, RETURNED, SAMPLE, OTHER.
- All operations wrapped in `db.$transaction` (product update + movement + optional price history) so the books stay consistent.
- User resolved from body or first available user (matches sales/purchases pattern).
- Returns `{ product, movement, previousStock, newStock, stockDelta, priceChanged, previousPurchasePrice, previousSellingPrice, newPurchasePrice, newSellingPrice }` with status 201.

## Dialog Component Highlights
- 3 mode cards (Add Stock / Remove Stock / Set Quantity) with emerald / rose / amber accents.
- Contextual reason select (IN: RESTOCK/FOUND/RETURNED/SAMPLE/OTHER; OUT: LOST/DAMAGED/RETURNED/OTHER; ADJUST: COUNT_CORRECTION/OTHER).
- Quantity input — delta for IN/OUT, absolute new value for ADJUST.
- Optional price update section (IN only) with toggle pill ("Keep current" ↔ "On"), new purchase/selling price inputs defaulting to current values, profit margin preview (Rs + %).
- Optional note textarea.
- Live preview card: stock before→after with delta tone, stock-value (retail) before→after, after-state StockBadge with "below min" hint.
- Validation: qty > 0 for IN/OUT, qty ≥ 0 for ADJUST, stock won't go negative for OUT (shows inline error), price inputs must be ≥ 0.
- Loading state on submit button; success toast with new quantity; invalidates products / product / dashboard / dash-summary / movements / transfers / notifications-lowstock queries.
- "Adjust state during render" pattern (no useEffect+setState) for syncing reason when the type changes — complies with strict `react-hooks/set-state-in-effect` rule.
- Keyed remount pattern (key=product.id) so internal state resets cleanly when target product changes.
- Emerald design system only. Mobile-first responsive.

## QuickRestockButton
- Renders a shadcn Button (default variant = primary emerald) with `ArrowDownToLine` icon + optional label.
- Internal `useState` for dialog open. Renders paired `StockAdjustDialog` with `initialMode="IN"`.
- Props: `product`, `label?`, `className?`, `variant?`, `size?`, `disabled?`, `stopPropagation?`.
- Label hidden on `<sm` for compactness in tables.
- Used in inventory-view row actions.

## Verification
- `bun run lint`: **0 errors / 0 warnings** project-wide.
- `npx tsc --noEmit --skipLibCheck`: **0 errors in any of my 5 touched files** (143 pre-existing errors in other agents' files — out of scope).
- Dev log: only `✓ Compiled in NNN ms` entries and `201` / `400` / `404` responses for `/api/products/.../adjust`. Zero `⨯` errors referencing my files.
- Live API smoke tests (curl):
  - TEST 1: IN +5 RESTOCK → 201, stock 26→31, movement type=IN ✓
  - TEST 2: OUT -2 DAMAGED → 201, stock 31→29, movement type=OUT, note `[damaged] curl test remove` ✓
  - TEST 3: ADJUST → 50 COUNT_CORRECTION → 201, stock 29→50, movement qty=21, note `[count correction] 29 → 50. yearly count` ✓
  - TEST 4: IN +3 with newPurchasePrice=1200 & newSellingPrice=2000 → 201, priceChanged=true, PriceHistory entry created with note `Adjustment IN · restock` ✓
  - TEST 5: OUT 9999 (exceeds stock 53) → 400 `Insufficient stock. Available: 53, requested: 9999` ✓
  - TEST 6: missing reason → 400 `reason is required and must be a valid value` ✓
  - TEST 7: invalid reason "WHATEVER" → 400 ✓
  - TEST 8: 0 qty for IN → 400 `qty must be greater than 0 for IN / OUT adjustments` ✓
  - TEST 9: nonexistent product id → 404 `Product not found` ✓
- Test data restored: product stock back to 26, prices back to 1058/1764.

## Stage Summary
Stock Adjustment + Quick Restock feature is complete and production-ready. 3 files created (1 API route + 2 shared components) and 2 files modified surgically (header button in ProductDetailSheet + Restock action in InventoryView table). The endpoint is transactional and validated, supporting IN/OUT/ADJUST with reason tracking and optional price updates + PriceHistory. The dialog is polished, intuitive, mobile-first responsive, emerald-themed (with rose/amber accents for OUT/ADJUST), and provides a live before→after preview with stock + value delta. The QuickRestockButton gives a one-click entry to the Add Stock mode from the inventory table. All curl tests pass; lint clean; dev server compiles cleanly; no regressions.
