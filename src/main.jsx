import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

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
