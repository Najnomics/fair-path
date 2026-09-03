import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function with0x(raw: string): string {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  if (!t) return "";
  return t.startsWith("0x") ? t : `0x${t}`;
}

/** `npm run dev` only: lift `PRIVATE_KEY` from the repo `.env`. Never on `vite build`. */
function devPrivateKey(mode: string, command: string): string {
  if (command !== "serve" || mode !== "development") return "";
  const repo = loadEnv(mode, resolve(__dirname, ".."), "");
  return with0x(repo.PRIVATE_KEY ?? "");
}

export default defineConfig(({ mode, command }) => ({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_PRIVATE_KEY": JSON.stringify(devPrivateKey(mode, command)),
  },
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
}));
