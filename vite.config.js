import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps the build portable — it works on GitHub Pages, in any
// subdirectory, or served straight from a static file server.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
