import { defineConfig } from "vite"
import { resolve } from "path"
import { externalizeDepsPlugin } from "electron-vite"

export default defineConfig({
  plugins: [externalizeDepsPlugin()],
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/preload.ts"),
      formats: ["cjs"],
      fileName: () => "preload.js",
    },
    rollupOptions: {
      external: ["electron"],
    },
    emptyOutDir: false,
    ssr: true,
  },
})
