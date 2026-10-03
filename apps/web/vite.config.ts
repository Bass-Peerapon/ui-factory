import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, "../.."), "");
  return {
    envDir: resolve(__dirname, "../.."),
    plugins: [react(), tailwindcss()],
    server: { port: Number(env.WEB_PORT || 5173), strictPort: true },
    build: {
      rollupOptions: {
        input: { main: resolve(__dirname, "index.html"), frame: resolve(__dirname, "frame.html") },
      },
    },
  };
});
