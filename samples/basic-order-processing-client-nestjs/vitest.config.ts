import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "@amqp-contract/testing/global-setup",
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**"],
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
