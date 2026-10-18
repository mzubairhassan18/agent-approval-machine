import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  target: "es2018",
  dts: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
});
