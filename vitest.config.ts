import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Keep failure output readable (testing-library dumps the DOM otherwise).
    env: { DEBUG_PRINT_LIMIT: "500" },
  },
});
