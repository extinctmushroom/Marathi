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

// A previous release shipped a caching service worker that broke reloads on
// iOS Safari (first load fine, next load stalled on a bad cache). Nothing is
// registered now, and any worker still installed from that release is torn
// down here — belt and braces alongside the self-unregistering sw.js.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((r) => r.unregister()))
    .catch(() => {});
  if (window.caches?.keys) {
    caches
      .keys()
      .then((keys) => keys.forEach((key) => caches.delete(key)))
      .catch(() => {});
  }
}
