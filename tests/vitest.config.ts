import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "@amqp-contract/testing/global-setup",
    reporters: ["default"],
    coverage: {
      enabled: false,
      provider: "v8",
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
