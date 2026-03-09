import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin({
      // Store CSS in a global variable instead of injecting into document.head.
      // HA panels live inside shadow DOM, so document.head styles don't reach them.
      injectCode: (cssCode: string) => {
        return `try{if(typeof document<"u"){window.__EXTENDED_GRAPH_AGENTS_CSS__=${cssCode}}}catch(e){console.error("css-inject",e)}`;
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.tsx"),
      name: "ExtendedGraphAgentsPanel",
      fileName: () => "panel.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        globals: {},
      },
    },
    outDir: "../custom_components/extended_graph_agents/www",
    emptyOutDir: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
