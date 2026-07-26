import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite reads process.env at config-evaluation time, so it needs the root .env
// loaded here — api-server's dotenv setup happens in a different process.
loadEnv({ path: path.resolve(import.meta.dirname, "..", "..", ".env") });

// WEB_PORT rather than PORT: PORT belongs to api-server, and both read the same
// root .env, so sharing the name would collide.
const port = Number(process.env.WEB_PORT ?? 5173);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid WEB_PORT value: "${process.env.WEB_PORT}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const calUrl =
  process.env.CAL_URL ?? "https://cal.com/capturesbycapri/appointment";

// Replaces the Replit artifact router, which used to route /api to :3000 for us.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000";

export default defineConfig({
  base: basePath,
  define: {
    __CAL_URL__: JSON.stringify(calUrl),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: true,
    fs: {
      strict: true,
    },
    proxy: {
      // changeOrigin: false keeps the Host header as localhost:<WEB_PORT> so the
      // admin session cookie's implicit domain matches.
      "/api": { target: apiTarget, changeOrigin: false },
      "/media": { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    port,
    host: true,
  },
});
