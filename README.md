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

**Waiter ownership**: waiters can only modify orders they created. This is enforced at the app level (`isOrderOwner` in `lib/utils.ts`) for the POC. In production, this should be enforced via Supabase RLS with auth (see comments in `schema.sql`).

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

1. In the Supabase dashboard, go to **SQL Editor**.
2. Paste the contents of `supabase/schema.sql`.
3. Run the script. This creates the tables (`categories`, `dishes`, `orders`, `order_items`), enables RLS, activates Realtime, and seeds the initial menu.

### 5. (Optional) Adjust the menu

Main dish prices are placeholders. Edit the values in `supabase/schema.sql` before running it, or update the records directly in Supabase (**Table Editor → dishes**).

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
3. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
4. Deploy. Vercel detects Next.js automatically.

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
└── schema.sql                  # SQL schema + seed data
```

## Scripts

```bash
pnpm dev       # Development server
pnpm build     # Production build
pnpm start     # Production server
pnpm lint      # ESLint
```

## Language

- **Code, comments, and documentation**: English
- **User-facing UI text**: Spanish (the app is for a Spanish-speaking restaurant)

## Pending

- [ ] Fill in real menu prices (items 1–9 are placeholders)
- [ ] Add PWA icons (`public/icon-192.png`, `public/icon-512.png`)
- [ ] Replace `window.print()` with printer bridge integration
- [ ] Authentication (not needed for the POC, but required for production RLS enforcement)
- [ ] POS order editing (waiters can only edit their own orders — `isOrderOwner` helper ready)
