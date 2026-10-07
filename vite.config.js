import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "./" keeps the build portable — it works on GitHub Pages, in any
// subdirectory, or served straight from a static file server.
export default defineConfig({
  plugins: [
    react(),
    // Offline support via Workbox. The previous hand-rolled worker cached
    // index.html independently of the bundle, so after a deploy a stale
    // shell could point at an asset hash that no longer existed and the app
    // would fail to start. Workbox precaches the shell and its assets as one
    // revisioned set, and drops superseded caches on activation, so the two
    // can never disagree.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      // manifest.webmanifest and the icons are maintained by hand in public/.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Google Fonts stylesheet — keep it fresh, fall back to cache.
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            // The font files themselves never change; cache them long-term.
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Speech clips are left out of the precache (hundreds of files that
            // most learners will only partly use). Cache each one the first
            // time it is played, then serve it offline. rangeRequests lets the
            // complete cached copy answer the Range requests <audio> makes —
            // Safari refuses media that ignores them. Clips are named by a hash
            // of their text, not their voice, so the max age bounds how long a
            // changed voice can linger.
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && /\/audio\/[0-9a-f]+\.mp3$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "marathi-audio",
              expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            // Which clips exist — keep it fresh, fall back to cache offline.
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.endsWith("/audio/manifest.json"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "marathi-audio-manifest" },
          },
        ],
      },
    }),
  ],
  base: "./",
});
