import { GenericContainer, Wait } from "testcontainers";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- Module augmentation requires interface for declaration merging
  export interface ProvidedContext {
    __TESTCONTAINERS_RABBITMQ_IP__: string;
    __TESTCONTAINERS_RABBITMQ_PORT_5672__: number;
    __TESTCONTAINERS_RABBITMQ_PORT_15672__: number;
  }
}

/**
 * Setup function for Vitest globalSetup
 * Starts a RabbitMQ container before all tests
 */
export default async function setup({ provide }: TestProject) {
  console.log("🐳 Starting RabbitMQ test environment...");

  // Start RabbitMQ container with management plugin
  const rabbitmqContainer = await new GenericContainer("rabbitmq:4.2.1-management-alpine")
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
    .start();

  console.log("✅ RabbitMQ container started");

  const __TESTCONTAINERS_RABBITMQ_IP__ = rabbitmqContainer.getHost();
  const __TESTCONTAINERS_RABBITMQ_PORT_5672__ = rabbitmqContainer.getMappedPort(5672);
  const __TESTCONTAINERS_RABBITMQ_PORT_15672__ = rabbitmqContainer.getMappedPort(15672);

  // Provide context values with type assertions to work around TypeScript limitations
  provide("__TESTCONTAINERS_RABBITMQ_IP__", __TESTCONTAINERS_RABBITMQ_IP__);
  provide("__TESTCONTAINERS_RABBITMQ_PORT_5672__", __TESTCONTAINERS_RABBITMQ_PORT_5672__);
  provide("__TESTCONTAINERS_RABBITMQ_PORT_15672__", __TESTCONTAINERS_RABBITMQ_PORT_15672__);

  console.log(
    `🚀 RabbitMQ test environment is ready at ${__TESTCONTAINERS_RABBITMQ_IP__}:${__TESTCONTAINERS_RABBITMQ_PORT_5672__}`,
  );
  console.log(
    `📊 RabbitMQ management console available at http://${__TESTCONTAINERS_RABBITMQ_IP__}:${__TESTCONTAINERS_RABBITMQ_PORT_15672__}`,
  );

  // Return cleanup function
  return async () => {
    console.log("🧹 Stopping RabbitMQ test environment...");
    await rabbitmqContainer.stop();
    console.log("✅ RabbitMQ test environment stopped");
  };
}
