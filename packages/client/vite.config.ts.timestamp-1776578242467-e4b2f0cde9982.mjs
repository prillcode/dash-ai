// vite.config.ts
import { defineConfig } from "file:///home/prill/dev/dash-ai/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.33_lightningcss@1.31.1/node_modules/vite/dist/node/index.js";
import react from "file:///home/prill/dev/dash-ai/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.33_lightningcss@1.31.1_/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///home/prill/dev/dash-ai/node_modules/.pnpm/@tailwindcss+vite@4.2.1_vite@5.4.21_@types+node@20.19.33_lightningcss@1.31.1_/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "/home/prill/dev/dash-ai/packages/client";
var vite_config_default = defineConfig({
  plugins: [tailwindcss(), react()],
  envDir: "../..",
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/ws": { target: "ws://localhost:3000", ws: true }
    }
  },
  build: {
    outDir: "dist"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcmlsbC9kZXYvZGFzaC1haS9wYWNrYWdlcy9jbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3ByaWxsL2Rldi9kYXNoLWFpL3BhY2thZ2VzL2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9wcmlsbC9kZXYvZGFzaC1haS9wYWNrYWdlcy9jbGllbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIlxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIlxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MoKSwgcmVhY3QoKV0sXG4gIGVudkRpcjogXCIuLi8uLlwiLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICBcIi9hcGlcIjogXCJodHRwOi8vbG9jYWxob3N0OjMwMDBcIixcbiAgICAgIFwiL3dzXCI6IHsgdGFyZ2V0OiBcIndzOi8vbG9jYWxob3N0OjMwMDBcIiwgd3M6IHRydWUgfSxcbiAgICB9LFxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogXCJkaXN0XCIsXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1UyxTQUFTLG9CQUFvQjtBQUNwVSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxVQUFVO0FBSGpCLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDaEMsUUFBUTtBQUFBLEVBQ1IsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsT0FBTyxFQUFFLFFBQVEsdUJBQXVCLElBQUksS0FBSztBQUFBLElBQ25EO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLEVBQ1Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
