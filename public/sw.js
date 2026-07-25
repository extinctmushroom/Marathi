/* Service worker: makes the course usable offline.
 *
 * Strategy:
 *   - navigations  → network-first, falling back to the cached shell
 *     (so a reload on the train still opens the app)
 *   - same-origin  → cache-first (Vite asset filenames are content-hashed,
 *     so a cached hit is always the right bytes)
 *   - cross-origin → stale-while-revalidate (Google Fonts)
 */

const VERSION = "v1";
const CACHE = `marathi-shika-${VERSION}`;
const SHELL = "./index.html";
const CORE = ["./", SHELL, "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individual failures shouldn't abort the whole install.
      .then((cache) => Promise.allSettled(CORE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // App shell for any navigation.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) cachePut(SHELL, response);
          return response;
        })
        .catch(() =>
          caches.match(SHELL).then((hit) => hit || caches.match("./") || Response.error())
        )
    );
    return;
  }

  // Hashed same-origin assets.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response && response.ok) cachePut(request, response);
            return response;
          })
      )
    );
    return;
  }

  // Fonts and other cross-origin GETs.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === "opaque")) cachePut(request, response);
          return response;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
