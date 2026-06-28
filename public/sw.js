// Simple service worker for PWA — matches the Next.js team's recommended approach.
// https://nextjs.org/docs/app/guides/progressive-web-apps

const CACHE_NAME = "punto5-v4";
const OFFLINE_URL = "/~offline";
const DASHBOARD_URL = "/dashboard";
const NOTIFICATIONS_STORE = "notifications";
const NOTIFICATIONS_DB = "punto5-notifications";
const NOTIFICATIONS_DB_VERSION = 1;

// Precache the offline page and dashboard on install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, DASHBOARD_URL]).catch(() => cache.add(OFFLINE_URL)),
    ),
  );
  // Activate immediately instead of waiting for all tabs to close
  self.skipWaiting();
});

// Allow the page to trigger skipWaiting via postMessage
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
      )
      .then(() => self.clients.claim()),
  );
});

// --- IndexedDB helper for storing notifications ---

function saveNotification(notification) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(NOTIFICATIONS_DB, NOTIFICATIONS_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(NOTIFICATIONS_STORE)) {
          const store = db.createObjectStore(NOTIFICATIONS_STORE, { keyPath: "id", autoIncrement: true });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(NOTIFICATIONS_STORE, "readwrite");
        tx.objectStore(NOTIFICATIONS_STORE).add(notification);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); resolve(); };
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// --- Handle push events — show notification + persist to IndexedDB ---

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Punto 5", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Punto 5";
  const body = data.body || "Tienes una actualización de pedido";
  const tag = data.tag || "order-update";
  const url = data.url || "/pos";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag,
    renotify: true,
    data: { url, title, body, tag, timestamp: Date.now() },
  };

  // Persist notification to IndexedDB so the app can show it later
  const notification = {
    title,
    body,
    tag,
    url,
    timestamp: Date.now(),
    read: false,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      saveNotification(notification),
    ]),
  );
});

// --- Handle notification click — focus or open the app ---

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/pos";
  // Build absolute URL — clients.openWindow requires absolute URLs on iOS
  const absoluteUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open (match by origin + path)
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          // Navigate to the target path if different, then focus
          if (clientUrl.pathname !== path && client.navigate) {
            client.navigate(absoluteUrl);
          }
          return client.focus();
        }
      }
      // Open new tab with absolute URL
      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }
    }),
  );
});

// --- Fetch strategy ---
// Navigations: network-first (so new HTML is always fetched).
// Static assets (JS/CSS/images): stale-while-revalidate — serve from cache
// immediately for speed, but fetch a fresh copy in the background so the
// next load gets the updated bundle.

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

  // For other requests, use stale-while-revalidate:
  // 1. Serve from cache immediately (fast)
  // 2. Fetch from network in background and update cache (fresh next time)
  const cached = caches.match(request);
  const networkFetch = fetch(request).then((response) => {
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  });

  event.respondWith(
    cached.then((cachedResponse) => cachedResponse || networkFetch).catch(() => networkFetch),
  );
});
