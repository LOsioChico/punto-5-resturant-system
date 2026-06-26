// Simple service worker for PWA — matches the Next.js team's recommended approach.
// https://nextjs.org/docs/app/guides/progressive-web-apps

const CACHE_NAME = "punto5-v1";
const OFFLINE_URL = "/~offline";

// Precache the offline page on install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)),
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

// Serve cached assets when offline, fall back to offline page for navigations.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") return;

  // For navigation requests, try network first, fall back to offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL)),
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
