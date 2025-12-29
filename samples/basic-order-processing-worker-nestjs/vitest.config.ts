import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "@amqp-contract/testing/global-setup",
    reporters: ["default"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**"],
    },
  },
});
