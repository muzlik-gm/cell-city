# AGENTS.md — Cell City AI Agent Steering Document

## Project Overview
Cell City is a **Mobile Spare Parts Compatibility Search Engine** — a multi-tenant SaaS application for mobile phone spare parts shops. Built with Next.js 16 (App Router), Prisma + SQLite, shadcn/ui, and the z-ai-web-dev-sdk VLM for AI camera identification.

## Architecture

### Multi-Tenant Model
```
AppUser (personal account)
  └── Business (workspace, scoped by handle)
        ├── Employees (sub-accounts with rank-based access)
        ├── Products, Inventory, Sales, Purchases, Repairs
        ├── Brands, Phone Models, Part Types, Compatibility
        └── Suppliers, Customers, Settings
```

- **AppUser**: registers with username + email + password. Can own multiple businesses.
- **Business**: created inside an AppUser account. Has a unique handle per owner (e.g. `cell-city`). All data is scoped to a Business.
- **Employee**: sub-account created by the business owner/manager. Logs in with business handle + username + password. Has a rank (OWNER, MANAGER, SALES_STAFF, TECHNICIAN, WAREHOUSE_STAFF).

### Authentication Flow
1. App User registers → creates personal account (no business yet)
2. App User creates a Business → gets a business handle
3. App User can create Employee sub-accounts with username + password
4. Employees log in via the "Employee" tab with business handle + username + password
5. Session is a base64 token stored in an httpOnly cookie (7-day expiry)

### Data Isolation
- Every data model (Product, Sale, Brand, etc.) has a `businessId` field
- All API routes use `getBusinessId()` from `@/lib/business-context` to scope queries
- A new business starts with ZERO data — no shared seed data visible

### Role-Based Access Control
| Rank | Nav Access |
|------|-----------|
| App User (Owner) | All views + Admin Panel |
| OWNER | All views + Admin Panel |
| MANAGER | All views + Admin Panel |
| SALES_STAFF | Home, Inventory, Sales, Repairs |
| TECHNICIAN | Home, Inventory, Repairs |
| WAREHOUSE_STAFF | Home, Inventory, Purchases |

## Key Conventions

### File Structure
```
src/
  app/
    api/           # REST API route handlers
    page.tsx       # Single SPA route (auth → onboarding → app shell)
  components/
    auth/          # Auth page, business onboarding
    shared/        # Reusable components (cards, dialogs, widgets)
    views/         # View components (home, inventory, sales, etc.)
    app-shell.tsx  # Sidebar + topbar + view router
  lib/
    auth.ts           # Server-only auth (bcrypt, session, cookies)
    auth-constants.ts # Client-safe rank constants
    auth-store.ts     # Zustand auth store (client)
    business-context.ts # getBusinessId() helper
    db.ts             # Prisma client
    store.ts          # UI state (Zustand)
```

### API Conventions
- All API routes are in `src/app/api/*/route.ts`
- Use `import { api } from "@/lib/api"` on the client (prepends `/api`)
- Use `import { db } from "@/lib/db"` on the server
- Always scope data queries by `businessId` via `getBusinessId()`
- Return JSON with proper HTTP status codes

### Design System
- **Framework**: Next.js 16 App Router (single `/` route SPA)
- **Styling**: Tailwind CSS 4 with shadcn/ui (New York style)
- **Accent**: Emerald (oklch) — NO indigo/blue
- **Typography**: Large, readable (product names 20-24px, values 22-28px)
- **Cards**: 2-column grid, large images, generous padding
- **Dark mode**: via next-themes

### Skills Installed
- `impeccable-uxui` — UX/UI design language
- `frontend-design-3` — Frontend design patterns
- `ui-ux-pro-max` — UI/UX best practices

## Development Commands
```bash
bun run dev          # Start dev server (port 3000)
bun run lint         # ESLint check
bun run db:push      # Push Prisma schema to SQLite
bun run prisma/seed.ts  # Seed database
```

## Login Credentials (after seed)
- **App User**: `bilal` / `password123`
- **Employees**: `usman`, `ali`, `hamza` / `password123` (business handle: `cell-city`)

## Important Rules for AI Agents
1. **NEVER** create new Next.js pages/routes — only `src/app/page.tsx` is user-visible
2. **NEVER** use `Math.random()` in seed data — use deterministic values
3. **NEVER** use Prisma `mode: "insensitive"` — not supported by SQLite
4. **ALWAYS** scope data queries by `businessId` via `getBusinessId()`
5. **ALWAYS** use the emerald design system — no indigo/blue
6. **ALWAYS** use `await cookies()` in Next.js 16 (returns a Promise)
7. **ALWAYS** split server-only code from client-safe code (auth.ts vs auth-constants.ts)
8. Keep the UI fast and simple — minimal clicks, large touch targets, readable text
