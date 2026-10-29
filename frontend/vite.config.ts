import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// API_URL points at the backend container in docker compose.
const apiUrl = process.env.API_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Allow ngrok (and any tunnel) hostnames to reach the dev server.
    allowedHosts: true,
    // Docker on Windows doesn't forward file-change events into containers.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      "/api": apiUrl,
    },
  },
});
