"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type PermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * Manages Web Push subscription for the waiter.
 * - Requests notification permission
 * - Subscribes via service worker PushManager
 * - Stores the subscription in Supabase (push_subscriptions table)
 * - Cleans up on unmount
 */
export function usePushSubscription(waiterName: string | null) {
  // Compute initial permission from the browser API (lazy initializer avoids effect)
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission as PermissionState;
  });
  const [subscribed, setSubscribed] = useState(false);

  // Check if already subscribed on mount (async — no synchronous setState)
  useEffect(() => {
    if (permission === "granted" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) setSubscribed(true);
        })
        .catch(() => {});
    }
  }, [permission]);

  const subscribe = useCallback(async () => {
    if (!waiterName || !VAPID_PUBLIC_KEY || !("serviceWorker" in navigator)) {
      console.warn("Push subscribe skipped:", { waiterName, hasVapid: !!VAPID_PUBLIC_KEY, hasSW: "serviceWorker" in navigator });
      return;
    }

    try {
      // Request permission if not already granted
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result as PermissionState);
        if (result !== "granted") return;
      } else if (Notification.permission !== "granted") {
        return;
      }

      // Get the service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Convert VAPID public key to Uint8Array for applicationServerKey
        const converted = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: converted as BufferSource,
        });
      }

      // Store in Supabase
      const supabase = createSupabaseClient();
      if (!supabase) return;

      const subJson = sub.toJSON();
      await supabase.from("push_subscriptions").upsert(
        {
          waiter_name: waiterName,
          endpoint: sub.endpoint,
          p256dh: subJson.keys?.p256dh ?? "",
          auth: subJson.keys?.auth ?? "",
        },
        { onConflict: "endpoint" },
      );

      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [waiterName]);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const supabase = createSupabaseClient();
        if (supabase) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, []);

  return { permission, subscribed, subscribe, unsubscribe };
}

/** Convert base64url VAPID key to Uint8Array for PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
