/* Self-destructing service worker.
 *
 * An earlier version of this file cached the app shell for offline use, but
 * it broke reloads on iOS Safari: the first visit worked, the next one was
 * served a bad cache and stalled. Deleting the file isn't enough — browsers
 * keep running an already-installed worker — so this replacement exists only
 * to tear that one down.
 *
 * It clears every cache, unregisters itself, and reloads open tabs. Offline
 * support may come back later via a battle-tested library rather than a
 * hand-rolled worker.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        /* keep going — unregistering matters more */
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        // Reload each open tab so it comes back uncontrolled and healthy.
        client.navigate(client.url).catch(() => {});
      }
    })()
  );
});

// Pass everything straight through while this worker is still alive.
self.addEventListener("fetch", () => {});
