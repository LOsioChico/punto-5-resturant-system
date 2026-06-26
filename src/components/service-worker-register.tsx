"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA support.
 * Follows the Next.js team's recommended approach:
 * https://nextjs.org/docs/app/guides/progressive-web-apps
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("SW registration failed:", err));
    }
  }, []);

  return null;
}
