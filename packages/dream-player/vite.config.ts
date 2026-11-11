import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    host: true,
    // Film manifests reference rendered assets as /storage/...; serve them from the API in dev.
    proxy: {
      "/storage": "http://localhost:8000",
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        film: resolve(__dirname, "film.html"),
      },
    },
  },
});
