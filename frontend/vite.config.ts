import {defineConfig} from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    // Same paths Vercel rewrites to the API function (see vercel.json).
    proxy: Object.fromEntries(["/api", "/employees", "/health"].map((path) => [path, {target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000", changeOrigin: false}])),
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
});
