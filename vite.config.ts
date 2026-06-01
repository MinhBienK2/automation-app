import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.ELECTRON_RENDERER_HOST;
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const ignoredWatchPath = (watchPath: string) => {
  const normalized = watchPath.split(path.sep).join("/");
  return (
    normalized.includes("/.local/") ||
    normalized.endsWith("/.local") ||
    normalized.includes("/test-results/") ||
    normalized.endsWith("/test-results") ||
    normalized.includes("/src-tauri/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/dist-electron/") ||
    normalized.includes("/release/")
  );
};

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(currentDir, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "src/tests/setup.ts",
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ignoredWatchPath,
    },
  },
}));
