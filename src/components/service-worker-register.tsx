"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA support.
 * Follows the Next.js team's recommended approach:
 * https://nextjs.org/docs/app/guides/progressive-web-apps
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Register in production, or on localhost for push notification testing
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (process.env.NODE_ENV === "production" || isLocalhost) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("SW registration failed:", err));
    }
  }, []);

  return null;
}
