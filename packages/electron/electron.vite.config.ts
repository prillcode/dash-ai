import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import { resolve } from "path"

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist",
      rollupOptions: {
        input: resolve(__dirname, "src/main.ts"),
        output: {
          format: "cjs",
          entryFileNames: "main.js",
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist",
      rollupOptions: {
        input: resolve(__dirname, "src/preload.ts"),
        output: {
          format: "cjs",
          entryFileNames: "preload.js",
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "../client"),
    build: {
      outDir: resolve(__dirname, "../client/dist"),
      rollupOptions: {
        input: resolve(__dirname, "../client/index.html"),
      },
    },
  },
})
