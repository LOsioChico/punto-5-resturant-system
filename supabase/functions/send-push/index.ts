// Supabase Edge Function — sends Web Push notifications to waiters
// when their order status changes.
//
// Triggered by a database webhook on the `orders` table (UPDATE event).
// The webhook sends the old and new row data as JSON in the request body.
//
// Env vars required:
//   VAPID_PUBLIC_KEY  — public VAPID key (same as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY — private VAPID key
//   VAPID_SUBJECT     — mailto: or URL for VAPID (e.g. mailto:admin@punto5.com)
//   SUPABASE_URL      — https://your-project.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY — service role key for DB access

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { webpush } from "https://esm.sh/web-push@3.6.7?bundle";

const STATUS_MESSAGES: Record<string, string> = {
  nueva: "pedido recibido",
  en_cocina: "pedido en cocina",
  lista: "pedido listo para servir",
  servida: "pedido servido",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const record = body.record;
    const oldRecord = body.old_record;

    // Only send push on status changes (not other field updates)
    if (!record || !oldRecord || record.status === oldRecord.status) {
      return new Response(JSON.stringify({ skipped: true, reason: "no status change" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const waiterName = record.waiter_name;
    const tableNumber = record.table_number;
    const newStatus = record.status;
    const statusMsg = STATUS_MESSAGES[newStatus] ?? newStatus;

    // Configure web-push
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@punto5.com",
      Deno.env.get("VAPID_PUBLIC_KEY") || "",
      Deno.env.get("VAPID_PRIVATE_KEY") || "",
    );

    // Get all push subscriptions for this waiter
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("waiter_name", waiterName);

    if (error) {
      throw new Error(`DB error: ${error.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no subscriptions for waiter" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const payload = JSON.stringify({
      title: `Mesa ${tableNumber}`,
      body: statusMsg.charAt(0).toUpperCase() + statusMsg.slice(1),
      tag: `order-${record.id}`,
      url: "/pos",
    });

    // Send push to all waiter's devices
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
    );

    // Remove subscriptions that returned 410 (gone) or 404 (not found)
    const deadEndpoints = results
      .map((r, i) => {
        if (r.status === "rejected") {
          const status = r.reason?.statusCode;
          if (status === 410 || status === 404) {
            return subscriptions[i].endpoint;
          }
        }
        return null;
      })
      .filter(Boolean);

    if (deadEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", deadEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;

    return new Response(
      JSON.stringify({
        sent,
        removed: deadEndpoints.length,
        waiter: waiterName,
        table: tableNumber,
        status: newStatus,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Push notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
