# Agent work record — Task 6-a

- **Task ID**: 6-a
- **Agent**: Z.ai Code (fullstack agent)
- **Task**: Add two features to PartsHub — a Quick Sell modal (sell a product without leaving the current view) and a Low-Stock Alerts widget for the home hero. Integrate both into `home-view.tsx` and the `SmartProductCard` component.

## Work Log

### Files created

1. **`src/components/shared/quick-sell-modal.tsx`** — Single-screen fast-sale dialog.
   - Outer `QuickSellModal` returns `null` when there is no product, otherwise renders a **keyed inner** (`QuickSellInner`, keyed by `product.id`) so all form state is initialized fresh from the product prop on every open / product change — no `useEffect` + `setState` (lint-safe).
   - **Product headline** card: name, in-stock (rose/amber/emerald tone), sell price, location — prominently at top.
   - **Quantity stepper** with big `+`/`-` buttons (h-14, disabled at bounds), large numeric input in the middle, max clamped to `product.stock`. Clamping uses the "adjust state during render" pattern (mirrors `StockAdjustDialog`).
   - **Editable price** input (defaults to `product.sellingPrice`) with `Rs` prefix.
   - **Customer select** (optional, default "Walk-in customer") — fetches `/api/customers` with `useQuery` (60s stale). Loading and empty states handled.
   - **Payment method** big button group — Cash / Card / Bank / Mobile (4 buttons, `Banknote` / `CreditCard` / `Building2` / `Smartphone` icons).
   - **Live total** (`qty × price`) in large emerald text in the sticky footer.
   - **Complete Sale** button POSTs to `/api/sales` with `{ customerId, items:[{productId, qty, price}], paymentMethod, paymentStatus:"PAID" }`. On success: `toast.success("Sold! {invoiceNo}", { description })`, closes modal, and invalidates `products`, `product`, `sales`, `universal-search`, `dash-summary`, `dashboard`, `notifications-lowstock`, `lowstock-count`, `home-lowstock`, `home-lowstock-summary`, `movements`. Loading spinner on the button while pending.
   - Out-of-stock guard: shows a rose warning and disables the submit button.
   - Emerald design, large touch targets (≥48px), responsive.

2. **`src/components/shared/low-stock-widget.tsx`** — Compact widget for the home hero.
   - Fetches `/api/dashboard/latest` (query key `home-lowstock`, returns `{ lowStock: [] }`) and `/api/dashboard/summary` (query key `home-lowstock-summary`, returns `lowStockCount`).
   - Header row: "Low Stock Alerts" with rose `AlertTriangle` icon + a count badge (rose when items exist, emerald "0" otherwise). Shows a spinner while loading.
   - Scrollable list (`max-h-48`) of the first 5 low-stock products. Each row: rose/amber icon, truncated product name, shelf code + part type, stock badge ("Out" rose / "{n} left" amber), `ChevronRight`. Clicking anywhere on the row calls `setView("inventory")` via `useAppStore`.
   - **Footer CTA**: when `lowStockCount > 5`, a "View all {n} low-stock items" button appears below the list — also navigates to Inventory.
   - **Positive empty state**: when no low-stock items, shows an emerald check circle + "All stocked up" + helpful copy.
   - Loading skeleton: three animated placeholder bars.

### Files modified (additive only)

3. **`src/components/shared/smart-product-card.tsx`** — Added optional `onQuickSell?: (p: Product) => void` prop.
   - Destructured into the component.
   - The "Sell" button's `onClick` is now `() => (onQuickSell ? onQuickSell(p) : onSell?.(p))` — falls back to `onSell` when `onQuickSell` isn't passed (so `inventory-view.tsx` is unaffected).

4. **`src/components/views/home-view.tsx`** — Integrated both features with minimal additive edits:
   - Imported `QuickSellModal` and `LowStockWidget`.
   - Added state `const [quickSellProduct, setQuickSellProduct] = useState<any>(null);`.
   - Passed `onQuickSell={(prod) => setQuickSellProduct(prod)}` to the single `SmartProductCard` usage in the search-results grid (kept `onSell={handleSell}` as the fallback).
   - Added `<QuickSellModal product={quickSellProduct} open={!!quickSellProduct} onOpenChange={(o) => !o && setQuickSellProduct(null)} />` alongside the other dialogs at the bottom.
   - Added `<LowStockWidget />` inside the `{!debounced && ...}` hero block, directly below the Popular Models section (so it only appears when no search query is active).

## Quality verification

- **Lint**: `bun run lint` → 0 errors, 0 warnings across the project.
- **Dev server**: `dev.log` shows the existing routes (`/api/dashboard/latest`, `/api/dashboard/summary`, `/api/customers`, `/api/sales`) all returning 200 — no errors or warnings logged. Dev server was already running on port 3000 and was not restarted.
- **Pattern compliance**:
  - Used the keyed-remount pattern (outer wrapper + keyed inner) — same as `StockAdjustDialog` and `ProductFormDialog`. No `useEffect` + `setState` for initializing form state from props.
  - API calls go through `import { api } from "@/lib/api"` (e.g., `api.post("/sales", body)`, `api.get("/customers")`) — client prepends `/api`.
  - Toasts via `import { toast } from "sonner"`.
  - Emerald design system throughout (rose/amber only for semantic states). No indigo/blue.
  - All copy on the Quick Sell modal is visible on one screen — no tabs, no nested dialogs.
  - Query invalidation covers all dependent data (products, sales, dashboard, search, low-stock notifications, movements).

## Stage Summary

Two production-grade features added to PartsHub with surgical, additive edits. The Quick Sell modal lets an operator complete a sale in under 10 seconds directly from search results — open card → Sell → adjust qty/price (optional) → pick payment → Complete Sale. The Low-Stock widget surfaces restocking urgency directly on the home hero without forcing a navigation to the dashboard. Both reuse existing design tokens, component primitives, and API contracts; no schema, API route, or existing component behavior was changed. Lint is clean and the dev server is healthy.

## Issues / notes

- None. The integration is backward-compatible: `SmartProductCard` consumers that don't pass `onQuickSell` (e.g., `inventory-view.tsx`) keep using `onSell` unchanged.
