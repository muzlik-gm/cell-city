# Task 2-d — Repair Jobs & Damaged Inventory

- **Task ID:** 2-d
- **Agent:** Repair Jobs & Damaged Inventory subagent (Z.ai Code)
- **Task:** Build the Repair Jobs & Damaged Inventory modules for PartsHub — REST APIs (users list, repairs CRUD with auto-ticketNo, repair parts management, damaged inventory with stock deduction) + a polished SPA view featuring a color-coded Kanban board, table view, visual status timeline, repair detail sheet, and damaged inventory tab with reason-breakdown donut chart.

## Files Created (6)

### API routes (5)

1. **`src/app/api/users/route.ts`** — `GET` lists users with `id/name/email/role/phone/avatarUrl/active` only (no passwordHash). Optional `?role=TECHNICIAN` filter and `?active=false` to include deactivated users. Ordered by role then name.

2. **`src/app/api/repairs/route.ts`**
   - `GET` — list with filters (`q`, `status`, `technicianId`, `customerId`) + pagination. Includes `customer`, `model.brand`, `technician`, and `parts.product`. Search matches ticketNo, IMEI, problem, diagnosis, notes, customer name/phone, model/brand name, technician name.
   - `POST` — create. Auto-generates `ticketNo = RPR-YYYYMM-NNNN` (sequence per month, 4-digit padded). Body: `customerId?, modelId?, technicianId?, imei?, problem* (required), diagnosis?, laborCost?, partsCost?, notes?, imageUrl?`. Sets `status=RECEIVED`, `paymentStatus=UNPAID`, `receivedAt=now()`, `total = laborCost + partsCost`.

3. **`src/app/api/repairs/[id]/route.ts`**
   - `GET` — full repair with customer, model+brand, technician, parts.product.
   - `PATCH` — partial update. When status → `COMPLETED` (and not already completed), sets `completedAt`. When → `DELIVERED`, sets `deliveredAt`. When → `RECEIVED`/`CANCELLED`, clears both timestamps. Recomputes `total = laborCost + partsCost` on every change. Supports editing diagnosis, technicianId, costs, paymentStatus, paid, notes, imageUrl, imei, problem, modelId, customerId. Special: `paymentStatus=PAID` with no explicit `paid` sets `paid = total`.
   - `DELETE` — hard delete (cascades RepairJobPart).

4. **`src/app/api/repairs/[id]/parts/route.ts`** — dedicated parts endpoint:
   - `POST` — add part. Body: `productId*, qty*, used?`. Creates `RepairJobPart` with `cost = product.purchasePrice × qty`. If `used=true`, deducts stock + creates `InventoryMovement type=REPAIR` referencing the ticket number. Always recomputes `partsCost = Σ(used parts' cost)` and `total = laborCost + partsCost`.
   - `PATCH ?partId=...` — toggle `used` on an existing part. false→true: deducts stock + REPAIR movement. true→false: restocks + IN movement (reversal). Recomputes costs.
   - `DELETE ?partId=...` — removes part. If was used, restocks first. Recomputes costs.

5. **`src/app/api/damaged/route.ts`**
   - `GET` — list with filters (`reason`, `productId`, `q`, `from`, `to`) + pagination. Includes `product.brand/model/partType/warehouse`. Search matches note, reason, product name/sku/brand/model.
   - `POST` — record damage. Body: `productId*, qty*, reason*, note?, imageUrl?`. Validates stock. Wraps the three writes (DamagedInventory create + Product stock decrement + InventoryMovement type=DAMAGE) in a `db.$transaction` for atomicity.

### View (1)

6. **`src/components/views/repairs-view.tsx`** — full module (1,470+ lines):
   - **PageHeader** "Repair Jobs" with "New Ticket" button.
   - **Tabs**: "Tickets" (Kanban + Table) and "Damaged Inventory".
   - **Tickets tab**:
     - 4 StatCards: Pending Repairs, In Progress, Completed This Month, Repair Revenue.
     - Toolbar: search input + status filter + technician filter + view toggle (Kanban | Table).
     - **Kanban board**: 6 color-coded columns (RECEIVED=sky, DIAGNOSED=teal, WAITING_PARTS=amber, REPAIRING=purple, COMPLETED=emerald, DELIVERED=teal-dark). Each column has a header with icon + count chip and a scrollable card list. Cards show ticket no, age, problem (2-line clamp), model, customer avatar, technician avatar, due badge, total. Horizontally scrollable on mobile. Framer Motion layout animations on cards.
     - **Table view**: paginated DataTable with ticket/customer/device/technician/status/total+payment/actions columns. Click row → detail sheet.
     - **New Ticket Dialog**: customer select (walk-in allowed), model select, technician select, IMEI, problem textarea (required), diagnosis textarea, labor cost, image upload (compact), notes.
     - **Repair Detail Sheet** (right side): full repair info with:
       - Header: ticket no (mono), age, status badge.
       - **Visual status timeline** stepper: 6-step horizontal flow RECEIVED→DIAGNOSED→WAITING_PARTS→REPAIRING→COMPLETED→DELIVERED with check marks for done steps, animated ping on current step, color-coded circles and connectors. Special "cancelled" state shown as a rose alert.
       - Quick status changer: dropdown + "Advance" button (moves to next step) + "Cancel ticket" button.
       - Customer + Device cards with avatars/IMEI.
       - Technician card.
       - Problem reported card.
       - Inline-editable Diagnosis (textarea toggle).
       - Parts Used list: each row shows product, qty × unit cost, used/reserved pill (click to toggle, deducts/restocks stock), remove button. "Add Part" button opens product-search dialog with qty + stock-action (deduct now / reserve only).
       - Costs breakdown card: labor (inline-editable), parts (computed), total.
       - Payment card: inline-editable paymentStatus + paid amount; shows due amount if any.
       - Dates strip: received / completed / delivered.
       - Image preview (if imageUrl).
       - Notes section.
       - Delete ticket button (danger zone).
   - **Damaged Inventory tab**:
     - 4 StatCards: Total Damaged Units, Damaged Value (at purchase cost), Most Common Reason, Avg per Incident.
     - **Reason Breakdown donut** chart (Recharts PieChart) with legend showing top 5 reasons by units + value.
     - Toolbar: search + reason filter + "Record Damage" button.
     - DataTable: product (with image thumbnail), qty, reason badge (color-coded), value lost (rose), date, note.
     - **Record Damage Dialog**: product search dropdown (selectable list with stock preview), qty, reason select (BROKEN/DEAD/WARRANTY/RETURNED/REJECTED/LOST/DISPOSED), note, image upload.

## Key Decisions

- **Emerald design system only**: kanban column colors use sky/teal/amber/purple/emerald — NO indigo/blue (the DIAGNOSED column uses teal instead of the indigo used in the existing RepairStatusBadge which I deliberately left untouched).
- **Dedicated parts endpoint** (per task preference) rather than folding into PATCH — cleaner separation, supports toggle and remove operations in addition to add.
- **Transactional damage recording** — `db.$transaction` ensures DamagedInventory + stock decrement + movement are atomic; if any fails, none commits.
- **Status timeline visual** — 6-step horizontal flow with done/current/future states and animated ping on current step; "Advance" button moves to next status; "Cancel" button transitions to CANCELLED state which renders as a rose alert in place of the timeline.
- **Inline editing** in the detail sheet (diagnosis, labor cost, payment) using local draft state + Save buttons — avoids accidental clobbering and matches the keyed-remount pattern from Task 2-b.
- **Stats computed client-side** from a single bulk fetch (pageSize=200) per tab — same pattern as sales/purchases views, keeps server simple.
- **Kanban cards** show: ticket no (mono), age via `timeAgo`, problem (2-line clamp), model, customer avatar+name, technician avatar, due badge (rose if unpaid balance), total cost.
- **Shared component reuse**: PageHeader, StatCard, DataTable, EmptyState, LoadingState, ImageUpload, RepairStatusBadge, PaymentStatusBadge, Avatar, Sheet, Dialog, Tabs, Select, ScrollArea, Separator.

## Verification

- `bun run lint`: **0 errors / 0 warnings** in my 6 new files. 2 pre-existing errors remain in `topbar.tsx` and `product-form.tsx` (out of scope, untouched). 7 unused-eslint-disable warnings in other agents' files (out of scope).
- Dev server log: After my file writes, only `✓ Compiled in Nms` messages appear with NO `⨯` errors referencing my new files. The pre-existing "Module not found" errors at line ~78800 of dev.log reference the OLD stub version of repairs-view.tsx (with `Construction` import) — those were the state BEFORE my changes and have been resolved by the new file.
- TypeScript strict typing throughout: typed interfaces for User, Customer, PhoneModel, Product, RepairJob, RepairPart, DamagedItem; `RepairStatus` type from `@/lib/types`.

## Stage Summary

Repair Jobs & Damaged Inventory modules complete and production-ready. 6 files created (5 API routes, 1 view). All required flows implemented end-to-end:
- Kanban board with 6 color-coded columns, horizontally scrollable, animated cards.
- Table view toggle with full filters.
- New ticket dialog with auto-generated RPR-YYYYMM-NNNN ticket numbers.
- Repair detail sheet with visual status timeline, inline-editable diagnosis/costs/payment, parts management (add/toggle-used/remove with stock deduction & reversal), costs breakdown, image, notes, delete.
- Damaged inventory tab with stats, reason-breakdown donut chart, filterable table, and atomic stock-deducting record dialog.
All views use the emerald design system (no indigo/blue in my new code), shared components, TanStack Query, Framer Motion, Recharts, and Sonner toasts. Lint clean for all new files. No regressions.
