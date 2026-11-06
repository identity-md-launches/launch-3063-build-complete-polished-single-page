import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// base "./" keeps every asset URL relative, so the export works at an IPFS gateway subpath or an ENS name.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
