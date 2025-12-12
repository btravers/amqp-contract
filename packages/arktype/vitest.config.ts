import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["**/*.spec.ts", "**/dist/**", "**/node_modules/**"],
    },
  },
});
