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
        ],
      },
    }),
  ],
  base: "./",
});
