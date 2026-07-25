import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app ships as a single self-contained index.html (see
// scripts/inline-build.mjs, which runs after the build).
//
// Why: a separate module bundle proved unreliable in the wild — the
// `assets/*.js` request could fail while the HTML loaded fine, leaving a
// page that never started. One file means one request: if the page loads
// at all, the app runs. An IIFE (rather than an ES module) keeps it
// working on browsers and networks that mishandle module scripts.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2018",
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
