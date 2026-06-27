import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/anthropic": {
        target:      "https://api.anthropic.com",
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/anthropic/, ""),
      },
      "/api/gmail": {
        target:      "https://gmail.googleapis.com",
        changeOrigin: true,
        rewrite:     (path) => path.replace(/^\/api\/gmail/, ""),
      },
    },
  },
});
