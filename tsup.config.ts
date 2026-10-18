import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/index": "src/core/index.ts",
    "machines/index": "src/machines/index.ts",
    "adapters/index": "src/adapters/index.ts",
    "ui/index": "src/ui/index.ts",
  },
  format: ["esm", "cjs"],
  target: "es2018",
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ["react", "react-dom"],
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});

// The "use client" directive is re-applied to the client entries by
// scripts/postbuild.mjs, because esbuild strips module level directives.
