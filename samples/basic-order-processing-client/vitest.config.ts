import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default"],
    globalSetup: "@amqp-contract/testing/global-setup",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**", "!src/**/*.integration.spec.ts"],
    },
  },
});
