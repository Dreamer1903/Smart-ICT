import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /api проксируется на FastAPI (uvicorn на :8000), включая SSE-стрим дашборда
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.VITE_API_PROXY ?? "http://localhost:8000", changeOrigin: true },
      // Симулятор внешних систем (1С/Robi) — только для разработки и демо
      "/sim": { target: process.env.VITE_SIM_PROXY ?? "http://localhost:8010", rewrite: (p) => p.replace(/^\/sim/, "") },
    },
  },
});
