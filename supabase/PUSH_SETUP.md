# Push Notifications Setup

## 1. Run the SQL

Run `supabase/schema.sql` in the Supabase SQL editor (or just the new `push_subscriptions` section if you already have the rest).

## 2. Deploy the Edge Function

```bash
# Install Supabase CLI if you don't have it
npm install -g supabase

# Login and link your project
supabase login
supabase link --project-ref lfkphqeayqsqgevkorot

# Deploy the function
supabase functions deploy send-push --no-verify-jwt
```

## 3. Set Edge Function Environment Variables

In Supabase Dashboard → Edge Functions → `send-push` → Secrets, add:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `BM2mdTcS_EdW-hnl8-tBzW7SUMhU3ConzvNdq4ZWAcWYsOgWS_UzfQct1PWuK4mX2INZ-TcXwT1tQz9uvkX4po0` |
| `VAPID_PRIVATE_KEY` | `KQXxjm2mFiEqxHbjfciufIUoWt40Dyj21xdNUkq6EXk` |
| `VAPID_SUBJECT` | `mailto:admin@punto5.com` |
| `SUPABASE_URL` | `https://lfkphqeayqsqgevkorot.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (Settings → API → `service_role` key) |

## 4. Create the Database Webhook

In Supabase Dashboard → Database → Webhooks → Create new webhook:

| Field | Value |
|---|---|
| Name | `order-status-push` |
| Table | `orders` |
| Events | `Update` |
| Type | `HTTP request` |
| URL | `https://lfkphqeayqsqgevkorot.supabase.co/functions/v1/send-push` |
| Method | `POST` |
| Headers | `Content-Type: application/json`, `Authorization: Bearer <anon_key>` |
| Body | `{ "record": {{ record }}, "old_record": {{ old_record }} }` |

This sends the old and new row data to the Edge Function whenever an order is updated. The function checks if the status changed and sends a push to the waiter.

## 5. How it works

1. Waiter opens POS → sees "Activar notificaciones" button → grants permission
2. Browser creates a push subscription via the service worker
3. Subscription is stored in `push_subscriptions` table linked to waiter name
4. Admin changes order status (e.g. "lista")
5. DB webhook fires → Edge Function runs
6. Edge Function fetches waiter's subscriptions → sends Web Push
7. Waiter's tablet shows notification: "Mesa 3 — Lista para servir"
8. Tapping the notification opens/focuses the POS tab

## Notes

- One waiter can have multiple subscriptions (multiple devices)
- Dead subscriptions (410/404) are automatically cleaned up
- Push only fires on status changes, not other field updates
- The notification payload includes a URL so tapping it opens `/pos`
