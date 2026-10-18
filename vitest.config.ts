import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Plain Node. No DOM, no jsdom, no framework renderer: the store, the
    // presets and the Vue SSR test all run without a browser. That is the point.
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
