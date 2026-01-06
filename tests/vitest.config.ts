import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "@amqp-contract/testing/global-setup",
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["default"],
    coverage: {
      enabled: false,
      provider: "v8",
    },
  },
});
