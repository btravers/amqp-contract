import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["@amqp-contract/testing/global-setup"],
    testTimeout: 30000,
  },
});
