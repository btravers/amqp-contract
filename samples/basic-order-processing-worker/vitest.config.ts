import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**", "!src/**/*.integration.spec.ts"],
    },
    projects: [
      {
        test: {
          name: "integration",
          globalSetup: "@amqp-contract/testing/global-setup",
          include: ["src/**/*.integration.spec.ts"],
        },
      },
    ],
  },
});
