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
          name: "unit",
          include: ["src/**/*.spec.ts"],
          exclude: ["src/**/*.integration.spec.ts"],
        },
      },
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
