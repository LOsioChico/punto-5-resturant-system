"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker for PWA support.
 * Follows the Next.js team's recommended approach:
 * https://nextjs.org/docs/app/guides/progressive-web-apps
 *
 * Also listens for SW updates and auto-reloads when a new version
 * takes over, so deployed changes reach installed PWAs without
 * requiring the user to manually close and reopen the app.
 */
export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Register in production, or on localhost for push notification testing
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (process.env.NODE_ENV === "production" || isLocalhost) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          // Check for updates every 60 seconds
          setInterval(() => reg.update(), 60_000);

          // When a new SW takes over, reload the page once
          let refreshing = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          // If a new SW is waiting to activate, tell it to skip waiting
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New SW installed — skip waiting so it activates immediately
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((err) => console.error("SW registration failed:", err));
    }
  }, []);

  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-sm text-stone-100 shadow-lg ring-1 ring-stone-700">
        Actualizando aplicación...
      </div>
    );
  }

  return null;
}
