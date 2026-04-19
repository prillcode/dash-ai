import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: "esm",
  target: "node18",
  splitting: false,
  sourcemap: false,
  clean: true,
  shims: false,
  external: [],
})
