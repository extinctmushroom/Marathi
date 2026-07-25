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

// The service worker is registered by vite-plugin-pwa (see vite.config.js),
// which injects registerSW.js. Nothing to do here.
//
// Note for future edits: do not add a getRegistrations()/unregister() sweep.
// One lived here while an older, broken worker was being retired, and once a
// real worker returned the two fought — the app tore down its own worker on
// every start, so offline never stuck and caches thrashed.
