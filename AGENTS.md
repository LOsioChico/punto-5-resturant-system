# Punto 5 — Restaurant Order System

## Quick Reference

- **Stack**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Supabase
- **Package manager**: pnpm 11 (lockfile: `pnpm-lock.yaml`)
- **Node**: 22+
- **Deploy**: Vercel (frontend) + Supabase (backend)

## Commands

```bash
pnpm dev               # Dev server
pnpm build             # Production build
pnpm lint              # ESLint (must pass with 0 errors)
pnpm test              # Unit/component tests (Vitest, 265 tests)
pnpm test:e2e          # E2E tests (Playwright, requires local Supabase + Docker)
pnpm supabase:start    # Start local Supabase
pnpm supabase:reset    # Reset local DB (re-run migrations)
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): lint + test + build on push to `main` and PRs.
- **Deploy**: Vercel auto-deploys on push to `main`. Enable GitHub Checks in Vercel settings to gate on CI.
- **Backup** (`.github/workflows/backup.yml`): hourly `pg_dump` of Supabase, only saves if data changed. Requires `SUPABASE_DB_URL` secret (pooler connection string).

## GitHub Secrets

| Secret | Purpose |
|---|---|
| `SUPABASE_DB_URL` | Pooler connection string for backup workflow |

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` + Vercel | Supabase publishable key (sb_publishable_) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` only (NOT Vercel) | Service role key for scripts (create-admin.mjs). Never exposed to client. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `.env.local` + Vercel | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | `.env.local` + Vercel | Web Push VAPID private key (server-only) |

## Database

- Schema is managed via **migrations only** (`supabase/migrations/`). No standalone `schema.sql`.
- Apply to remote: `npx supabase link --project-ref <ref> && npx supabase db push`
- Postgres version: 17 (Supabase). `pg_dump` must be version 17+ to dump.
- RLS enabled on all tables. Admin = full access, waiter = own orders only.

### Destructive operations — ASK FIRST

**Never run `DELETE`, `DROP`, `TRUNCATE`, or any data-modifying SQL against the remote/production database without showing the user the exact SQL and getting explicit confirmation.** This includes migrations that contain `DELETE` statements.

Before running any migration against the remote database:
1. Read the migration file
2. If it contains `DELETE`, `DROP`, `TRUNCATE`, or `ALTER TABLE ... DROP COLUMN`, show the user those specific lines
3. Wait for explicit "yes" before running

This rule exists because a migration with `DELETE FROM orders WHERE waiter_id IS NULL` was run against production without asking, wiping all test data. Even if data looks like test data, the decision is the user's — not the agent's.

## Key Conventions

- Code/comments in English, UI text in Spanish.
- Prices stored as integers (Colombian pesos).
- Table 18 = delivery/to-go (special handling in POS and dashboard).
- `desechables` = disposable container fee, auto-calculated per dish for delivery orders.
- `delivery_fee` = admin-set delivery charge, separate from desechables.
- Order status flow: `nueva` → `en_cocina` → `lista` → `servida`.
- Every order action is logged in `order_events` (audit trail).
- Waiter presence via Supabase Realtime presence channel.
- PWA: custom service worker in `public/sw.js`, registered via `service-worker-register.tsx`.

### Dates and Timezones

- **Always use `date-fns` and `date-fns-tz`** for date operations. Never use raw `new Date()` arithmetic (`.getTime()`, `Date.now() - ...`).
- **`new Date()` should only appear in `src/lib/timezone.ts`** — all other code uses helpers from that module.
- **Colombia timezone is UTC-5** (`America/Bogota`). All display formatting goes through `src/lib/timezone.ts` helpers (`formatInColombia`, `nowInColombia`, `startOfTodayColombia`).
- DB timestamps: use `nowISO()` from `timezone.ts` (uses date-fns `formatISO`) instead of `new Date().toISOString()`.
- For display: use `formatTime()` (from `utils.ts`) which calls `formatInColombia` with `HH:mm`.
- For elapsed time: use `timeAgo()` (from `utils.ts`) which uses `date-fns` `differenceInSeconds`/`differenceInMinutes`/`differenceInHours`.
- For date comparisons/sorting: use `compareDesc` from `date-fns`.
- Test files are exempt — `new Date().toISOString()` in test fixtures is fine.

### Mutations (DB writes)

- All order-related DB mutations go through `src/lib/mutations.ts`.
- The module enforces a consistent order of operations for realtime reliability:
  1. Write `order_items` (insert/update/delete)
  2. Write `order_events` (audit trail)
  3. Update `orders` **LAST** — this fires the Supabase realtime UPDATE event, and by this point all items and events are already committed.
- Components call mutation functions and handle UI state (optimistic updates, toasts, cart clearing).
- Never call `supabase.from("orders").update(...)` or `supabase.from("order_events").insert(...)` directly in components — use the mutation helpers.

## Linting Notes

- React 19 ESLint rules are strict: `react-hooks/set-state-in-effect` flags synchronous `setState` in effects.
- Legitimate cases (localStorage read on mount, clearing stale state on prop change) use `// eslint-disable-next-line react-hooks/set-state-in-effect` with a comment explaining why.
