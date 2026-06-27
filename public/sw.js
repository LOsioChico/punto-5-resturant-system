// Simple service worker for PWA — matches the Next.js team's recommended approach.
// https://nextjs.org/docs/app/guides/progressive-web-apps

const CACHE_NAME = "punto5-v2";
const OFFLINE_URL = "/~offline";
const DASHBOARD_URL = "/dashboard";

// Precache the offline page and dashboard on install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, DASHBOARD_URL]).catch(() => cache.add(OFFLINE_URL)),
    ),
  );
});

// Clean up old caches on activate.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
});

// Handle push events — show notification to waiter.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Punto 5", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Punto 5";
  const options = {
    body: data.body || "Tienes una actualización de pedido",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "order-update",
    renotify: true,
    data: { url: data.url || "/pos" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — focus or open the POS tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/pos";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});

// Serve cached assets when offline, fall back to cached pages for navigations.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") return;

  // For navigation requests, try network first, fall back to cached page.
  // This allows the dashboard to load from cache when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          // Try the exact cached URL first, then fall back to offline page
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // For other requests, try cache first, then network.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          // Cache successful same-origin responses.
          if (response.ok && new URL(request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
