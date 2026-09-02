import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/rpc": {
        target: "http://127.0.0.1:8546",
        changeOrigin: true,
        rewrite: () => "/",
      },
    },
  },
});
