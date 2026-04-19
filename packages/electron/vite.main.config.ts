import { defineConfig } from "vite"
import { resolve } from "path"
import { externalizeDepsPlugin } from "electron-vite"

export default defineConfig({
  plugins: [externalizeDepsPlugin()],
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: ["electron", "child_process", "path", "os", "fs", "fs/promises", "url"],
    },
    emptyOutDir: false,
    ssr: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
})
