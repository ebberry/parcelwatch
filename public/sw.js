/* ParcelWatch service worker — minimal offline shell.
 *
 * Strategy:
 *  - Navigations: network-first, falling back to a cached offline page.
 *  - Static assets (icons, manifest): cache-first.
 * We deliberately do NOT cache parcel data / API responses — provenance
 * freshness is product law, so live data must never be served stale by the SW.
 */
const CACHE = "parcelwatch-v1";
const PRECACHE = ["/offline", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never intercept API calls or auth — always live.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline").then((r) => r || Response.error())),
    );
    return;
  }

  // Static same-origin assets: cache-first.
  if (url.origin === self.location.origin && /\.(png|svg|ico|webmanifest|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return resp;
          }),
      ),
    );
  }
});
