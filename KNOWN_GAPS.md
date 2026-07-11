# KNOWN_GAPS.md — Punto 5 Restaurant Order System

> Per global rule G5: every module's verification status must be tracked here.

## Verification Status (verified 2026-07-10)

| Module | Status | Notes |
|---|---|---|
| POS (waiter order flow) | ✅ runtime-verified | 411 unit tests pass, 5 E2E suites, production build succeeds |
| Dashboard (admin order management) | ✅ runtime-verified | Same test suite covers dashboard logic + components |
| Auth (admin + waiter login) | ✅ runtime-verified | RLS enforced, session expiry, PIN change flow |
| Realtime (orders, presence) | ✅ runtime-verified | Supabase Realtime publication enabled, presence channel working |
| Web Push notifications | ✅ runtime-verified | send-push edge function deployed, VAPID keys configured |
| PWA (service worker, offline) | ✅ runtime-verified | Custom SW with cache versioning, offline page |
| DB migrations (13 files) | ✅ runtime-verified | All applied to remote, constraint verified correct via REST API test |
| CI/CD (lint + test + build) | ✅ runtime-verified | GitHub Actions passes on main |
| DB backups (hourly pg_dump) | ✅ runtime-verified | Content-hash dedup, git tag storage, 90-day artifacts |

## Known Gaps

### Functional gaps

| Gap | Severity | Status |
|---|---|---|
| Printer bridge integration | Medium | Pending — still uses `window.print()`, needs real printer hardware |
| Metrics/reporting module | Low | Not started — daily sales, popular items (future scope) |
| Menu prices are placeholders | Low | README notes this — needs real pricing from restaurant |

### Infrastructure gaps

| Gap | Severity | Status |
|---|---|---|
| No error tracking (Sentry) | Low | Production errors are invisible without manual checking |
| No rate limiting on edge functions | Low | manage-waiters and send-push have no rate limits |

### Resolved gaps (fixed 2026-07-10)

| Gap | Fix |
|---|---|
| DB constraint bug in adicional migration | Fixed — migration file corrected to use `finalizada` instead of reverted `lista` |
| send-push stale `lista` in STATUS_MESSAGES | Fixed — updated to match current status flow (servida, finalizada, adicional) |
| Unused import `getWaiterLoginTime` | Fixed — removed from use-auth.tsx |
| `Data/` and `Support/` dirs not gitignored | Fixed — added to .gitignore |
