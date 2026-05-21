import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8000,
    strictPort: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/chat": "http://127.0.0.1:8010",
      "/dashboard": "http://127.0.0.1:8010",
      "/get-data": "http://127.0.0.1:8010",
      "/get-features": "http://127.0.0.1:8010",
      "/risk": "http://127.0.0.1:8010",
      "/predict": "http://127.0.0.1:8010",
      "/graph": "http://127.0.0.1:8010",
      "/admin/update": "http://127.0.0.1:8010",
      "/health": "http://127.0.0.1:8010",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
}));
