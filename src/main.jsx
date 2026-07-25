import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

const container = document.getElementById("root");

try {
  createRoot(container).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err) {
  // Mounting itself failed (very old browser, blocked API). Say so plainly
  // rather than leaving the boot message spinning forever.
  container.innerHTML =
    '<div style="font-family:system-ui,sans-serif;max-width:34rem;margin:14vh auto;padding:0 1.5rem;text-align:center;color:#33203b">' +
    '<p style="font-size:1.05rem">This browser couldn\'t start the course.</p>' +
    '<p style="font-size:0.85rem;color:#6b5573">' +
    String(err && err.message ? err.message : err) +
    "</p></div>";
}

// Register the service worker so the course works offline once visited.
// Production only — in dev it would just serve stale bundles.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Resolve against the document so it works from any subpath (e.g. /Marathi/).
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {
      /* offline support is a bonus; never break the app over it */
    });
  });
}
