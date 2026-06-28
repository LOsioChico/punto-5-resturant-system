# Punto 5 — Order System

A proof of concept (POC) for a real-time restaurant order system with two views:

- **POS (Waiter)** — tablet/PWA for taking orders: table selection, categories, dishes, and order summary.
- **Dashboard (Owner)** — laptop view: real-time orders, active waiters, order detail, and kitchen ticket preview.

## Audit Trail

Every action on an order is logged in the `order_events` table, providing full traceability:

| Event type | Triggered by | Logged data |
|---|---|---|
| `created` | Waiter sends order from POS | actor (waiter name), table, item count, total |
| `status_changed` | Admin advances status on dashboard | actor (admin), from_status, to_status |
| `printed` | Admin clicks "Imprimir" on dashboard | actor (admin), timestamp |

The `orders` table also tracks `updated_by`, `updated_at`, and `updated_by_type` for quick "last modified" queries.

**Waiter ownership**: waiters can only modify orders they created. This is enforced at the app level (`isOrderOwner` in `lib/utils.ts`) for the POC. In production, this should be enforced via Supabase RLS with auth (see comments in `supabase/migrations/`).

**Print**: the "Imprimir" button triggers `window.print()` and logs a print event. Replace with a printer bridge integration when available.

The dashboard shows a timeline of all events for the selected order (yellow dot = created, blue dot = printed, gray dot = status change).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 (black & yellow theme) |
| Backend/BaaS | Supabase (Postgres + Realtime + Presence) |
| PWA | Native service worker (Next.js team's recommended approach) |
| Deploy | Vercel (frontend) + Supabase (backend) |
| Icons | lucide-react |

## Prerequisites

- Node.js 22+
- pnpm 11+
- A Supabase account (free tier works)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the project dashboard, go to **Settings → API**.
3. Under **Publishable and secret API keys**, copy the **Project URL** and the **publishable key** (starts with `sb_publishable_`).
4. Do NOT use the legacy `anon`/`service_role` keys — those are JWT-based and being deprecated.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key-here
```

### 4. Create the database schema

The schema is managed via Supabase migrations. To apply them to your remote project:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

This creates the tables (`categories`, `dishes`, `orders`, `order_items`, `order_events`, `push_subscriptions`), enables RLS, activates Realtime, and seeds the initial menu.

Alternatively, you can run each migration file in `supabase/migrations/` manually via the Supabase SQL Editor in order.

### 5. (Optional) Adjust the menu

Main dish prices are placeholders. Edit the seed data in `supabase/migrations/20260627160152_initial_schema.sql` before applying, or update the records directly in Supabase (**Table Editor → dishes**).

### 6. Run the dev server

```bash
pnpm dev
```

Open:
- `http://localhost:3000/pos` — waiter view (tablet)
- `http://localhost:3000/dashboard` — owner dashboard (laptop)

### 7. Test the real-time flow

1. Open `/pos` in one tab/window (simulates the tablet).
2. Enter a waiter name.
3. Select a table, add dishes to the order, and send to kitchen.
4. Open `/dashboard` in another tab/window (simulates the owner's laptop).
5. The order appears automatically on the dashboard. The waiter shows up under "Meseros activos".
6. Advance the order status: Nueva → En cocina → Lista → Servida.

## Deploy to Vercel

1. Push the repository to GitHub.
2. On [vercel.com](https://vercel.com), import the repository.
3. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
4. Deploy. Vercel detects Next.js automatically.
5. In Vercel project settings, enable **GitHub Checks** so deployments wait for CI to pass before promoting to production.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): runs lint, tests, and build on every push to `main` and on PRs.
- **Deploy**: Vercel auto-deploys on push to `main` after CI passes (enable GitHub Checks in Vercel settings).
- **Backup** (`.github/workflows/backup.yml`): dumps the Supabase database hourly via `pg_dump`, only saves if data changed. Requires `SUPABASE_DB_URL` secret (pooler connection string). Backups stored as GitHub Actions artifacts (90-day retention) and on a `backups` branch.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (PWA metadata, SW registration)
│   ├── page.tsx                # Landing — choose Waiter or Dashboard
│   ├── pos/page.tsx            # POS route
│   ├── dashboard/page.tsx      # Dashboard route
│   ├── ~offline/page.tsx       # Offline page (PWA)
│   └── manifest.json           # PWA manifest
├── components/
│   ├── pos/                    # WaiterStart, TableSelector, CategoryList, DishGrid, OrderSummary, PosClient
│   ├── dashboard/              # OrdersFeed, ActiveWaiters, OrderDetail, CommandPreview, DashboardClient
│   ├── ui/                     # Button, Card, Badge
│   └── service-worker-register.tsx
├── lib/
│   ├── supabase/               # client.ts, server.ts
│   ├── types.ts                # Domain types (Order, OrderEvent, etc.)
│   └── utils.ts                # cn(), formatCOP(), formatTime(), timeAgo(), isOrderOwner()
public/
└── sw.js                       # Service worker (PWA)
supabase/
├── config.toml                 # Local Supabase config
├── migrations/                 # Schema migrations (source of truth)
│   ├── *_initial_schema.sql    # Tables, RLS, Realtime, seed data
│   ├── *_notes_to_jsonb.sql    # Migrate notes to jsonb array
│   ├── *_add_delivery_name.sql # Delivery customer name column
│   └── *_add_delivery_fee.sql  # Delivery fee column
└── functions/
    └── send-push/              # Edge function for Web Push notifications
e2e/
├── helpers.ts                  # preparePage, dismissErrorOverlay
├── global-setup.ts             # Resets local DB before each run
├── 01-create-order.spec.ts     # POS create + admin verification
├── 02-edit-order.spec.ts       # POS edit (add/remove/modify + notes)
├── 03-admin-status.spec.ts     # Status advance + undo + history
├── 04-admin-detail.spec.ts     # Detail view (items, notes, preview, print)
└── 05-filters.spec.ts          # Dashboard filters (date, status, waiter)
```

## Scripts

```bash
pnpm dev               # Development server
pnpm build             # Production build
pnpm start             # Production server
pnpm lint              # ESLint
pnpm test              # Unit + component tests (Vitest)
pnpm test:watch        # Unit tests in watch mode
pnpm test:e2e          # E2E tests (Playwright) — requires local Supabase
pnpm test:e2e:ui       # E2E tests with Playwright UI
pnpm supabase:start    # Start local Supabase (Docker)
pnpm supabase:stop     # Stop local Supabase
pnpm supabase:reset    # Reset local DB (re-run migrations + seed)
```

## Testing

### Unit & Component Tests

```bash
pnpm test
```

Uses Vitest + React Testing Library. 265 tests across 8 files covering:
- Pure logic (formatting, filters, status flow, cart diffing)
- Component rendering (OrderDetail, OrderSummary, OrdersFeed, etc.)

### E2E Tests

E2E tests run against a **local Supabase instance** (Docker) — not the
production database. The Playwright global setup resets the DB before
each run for deterministic results.

**Prerequisites:**
- Docker Desktop running
- Supabase CLI installed (`brew install supabase/tap/supabase`)

**First-time setup:**

```bash
pnpm supabase:start    # Start local Supabase stack (Docker)
```

This starts Postgres, Auth, Realtime, Storage, and Studio on
`http://127.0.0.1:54321`. The DB schema and seed data are applied
automatically from `supabase/migrations/`.

**Running e2e tests:**

```bash
pnpm test:e2e
```

The test runner:
1. Resets the local DB (`supabase db reset`) via `e2e/global-setup.ts`
2. Starts the Next.js dev server with `.env.test` (points at local Supabase)
3. Runs all Playwright specs

**To stop local Supabase:**

```bash
pnpm supabase:stop
```

## Language

- **Code, comments, and documentation**: English
- **User-facing UI text**: Spanish (the app is for a Spanish-speaking restaurant)

## Pending

- [ ] Replace `window.print()` with printer bridge integration
- [ ] Authentication (not needed for the POC, but required for production RLS enforcement)
- [ ] Menu management UI (currently dishes are seeded via migrations only)
- [ ] Metrics/reporting module (future scope — daily sales, popular items)
