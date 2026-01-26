import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src/client",
  publicDir: "../../public",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});
