import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes the build portable — it works on GitHub Pages,
// any subdirectory, or opened straight from a static file server.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
