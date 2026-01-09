/**
 * Global setup module for starting RabbitMQ test containers
 *
 * This module provides a Vitest globalSetup function that automatically starts
 * a RabbitMQ container with the management plugin before tests run, and stops
 * it after all tests complete.
 *
 * The container automatically enables the `rabbitmq_delayed_message_exchange` plugin
 * which is required for the retry mechanism's exponential backoff functionality.
 *
 * The RabbitMQ image can be configured via the `RABBITMQ_IMAGE` environment variable.
 * By default, it uses the public Docker Hub image (`rabbitmq:4.2.1-management-alpine`).
 *
 * @module global-setup
 * @packageDocumentation
 */

import { GenericContainer, Wait } from "testcontainers";
import type { TestProject } from "vitest/node";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Default RabbitMQ Docker image to use for testing.
 * Can be overridden via RABBITMQ_IMAGE environment variable.
 *
 * By default, we build a custom image from the Dockerfile in this package
 * that includes the rabbitmq_delayed_message_exchange plugin.
 */
const DEFAULT_RABBITMQ_IMAGE = process.env["RABBITMQ_IMAGE"];

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Module augmentation requires interface for declaration merging
  export interface ProvidedContext {
    __TESTCONTAINERS_RABBITMQ_IP__: string;
    __TESTCONTAINERS_RABBITMQ_PORT_5672__: number;
    __TESTCONTAINERS_RABBITMQ_PORT_15672__: number;
    __TESTCONTAINERS_RABBITMQ_USERNAME__: string;
    __TESTCONTAINERS_RABBITMQ_PASSWORD__: string;
  }
}

/**
 * Setup function for Vitest globalSetup
 *
 * Starts a RabbitMQ container before all tests and provides connection details
 * to tests via Vitest's provide API. The container is automatically stopped
 * and cleaned up after all tests complete.
 *
 * The setup automatically enables the `rabbitmq_delayed_message_exchange` plugin
 * required for the retry mechanism with exponential backoff.
 *
 * This function should be configured in your `vitest.config.ts`:
 *
 * @example
 * ```typescript
 * import { defineConfig } from "vitest/config";
 *
 * export default defineConfig({
 *   test: {
 *     globalSetup: ["@amqp-contract/testing/global-setup"],
 *   },
 * });
 * ```
 *
 * @param provide - Function to provide context values to tests
 * @returns Cleanup function that stops the RabbitMQ container
 */
export default async function setup({ provide }: TestProject) {
  console.log("🐳 Starting RabbitMQ test environment...");

  let rabbitmqContainer;

  if (DEFAULT_RABBITMQ_IMAGE) {
    // Use custom image if provided via environment variable
    console.log(`📦 Using RabbitMQ image: ${DEFAULT_RABBITMQ_IMAGE}`);
    rabbitmqContainer = await new GenericContainer(DEFAULT_RABBITMQ_IMAGE)
      .withExposedPorts(5672, 15672)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: "guest",
        RABBITMQ_DEFAULT_PASS: "guest",
      })
      .withHealthCheck({
        test: ["CMD", "rabbitmq-diagnostics", "-q", "check_running"],
        interval: 1_000,
        retries: 30,
        startPeriod: 3_000,
        timeout: 5_000,
      })
      .withWaitStrategy(Wait.forHealthCheck())
      .withReuse()
      .withAutoRemove(true)
      .start();
  } else {
    // Build custom image from Dockerfile
    console.log("🔨 Building custom RabbitMQ image with delayed message exchange plugin...");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dockerfilePath = path.resolve(__dirname, "..");

    rabbitmqContainer = await GenericContainer.fromDockerfile(dockerfilePath)
      .build()
      .then((image) =>
        image
          .withExposedPorts(5672, 15672)
          .withEnvironment({
            RABBITMQ_DEFAULT_USER: "guest",
            RABBITMQ_DEFAULT_PASS: "guest",
          })
          .withHealthCheck({
            test: ["CMD", "rabbitmq-diagnostics", "-q", "check_running"],
            interval: 1_000,
            retries: 30,
            startPeriod: 3_000,
            timeout: 5_000,
          })
          .withWaitStrategy(Wait.forHealthCheck())
          .withReuse()
          .withAutoRemove(true)
          .start(),
      );
  }

  console.log("✅ RabbitMQ container started");

  // Enable the delayed message exchange plugin required for retry mechanism
  console.log("🔌 Enabling rabbitmq_delayed_message_exchange plugin...");
  const enablePluginResult = await rabbitmqContainer.exec([
    "rabbitmq-plugins",
    "enable",
    "rabbitmq_delayed_message_exchange",
  ]);

  if (enablePluginResult.exitCode !== 0) {
    console.error("❌ Failed to enable delayed message exchange plugin");
    console.error("stdout:", enablePluginResult.output);
    throw new Error(
      `Failed to enable rabbitmq_delayed_message_exchange plugin: ${enablePluginResult.output}`,
    );
  }

  console.log("✅ Delayed message exchange plugin enabled");

  const __TESTCONTAINERS_RABBITMQ_IP__ = rabbitmqContainer.getHost();
  const __TESTCONTAINERS_RABBITMQ_PORT_5672__ = rabbitmqContainer.getMappedPort(5672);
  const __TESTCONTAINERS_RABBITMQ_PORT_15672__ = rabbitmqContainer.getMappedPort(15672);
  const __TESTCONTAINERS_RABBITMQ_USERNAME__ = "guest";
  const __TESTCONTAINERS_RABBITMQ_PASSWORD__ = "guest";

  // Provide context values with type assertions to work around TypeScript limitations
  provide("__TESTCONTAINERS_RABBITMQ_IP__", __TESTCONTAINERS_RABBITMQ_IP__);
  provide("__TESTCONTAINERS_RABBITMQ_PORT_5672__", __TESTCONTAINERS_RABBITMQ_PORT_5672__);
  provide("__TESTCONTAINERS_RABBITMQ_PORT_15672__", __TESTCONTAINERS_RABBITMQ_PORT_15672__);
  provide("__TESTCONTAINERS_RABBITMQ_USERNAME__", __TESTCONTAINERS_RABBITMQ_USERNAME__);
  provide("__TESTCONTAINERS_RABBITMQ_PASSWORD__", __TESTCONTAINERS_RABBITMQ_PASSWORD__);

  console.log(
    `🚀 RabbitMQ test environment is ready at ${__TESTCONTAINERS_RABBITMQ_IP__}:${__TESTCONTAINERS_RABBITMQ_PORT_5672__}`,
  );
  console.log(
    `📊 RabbitMQ management console available at http://${__TESTCONTAINERS_RABBITMQ_IP__}:${__TESTCONTAINERS_RABBITMQ_PORT_15672__}`,
  );
}
