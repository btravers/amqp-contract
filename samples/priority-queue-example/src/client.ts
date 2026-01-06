/* eslint-disable sort-imports */
import { TypedAmqpClient } from "@amqp-contract/client";
import { priorityQueueContract } from "./contract.js";
import pino from "pino";
import { z } from "zod";

const env = z
  .object({
    AMQP_URL: z.string().url().default("amqp://localhost:5672"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .parse(process.env);

const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

async function main() {
  logger.info("=".repeat(60));
  logger.info("Priority Queue Demo - Publisher");
  logger.info("=".repeat(60));

  // Create type-safe client
  const client = await TypedAmqpClient.create({
    contract: priorityQueueContract,
    urls: [env.AMQP_URL],
  })
    .tapError((error) => logger.error({ error }, "Failed to create client"))
    .resultToPromise();

  logger.info("✅ Client ready");
  logger.info("");
  logger.info("Publishing tasks with different priorities...");
  logger.info("(Tasks will be consumed in priority order: 10 → 5 → 3 → 1 → 0)");
  logger.info("");

  // Publish tasks in mixed order to demonstrate priority ordering
  const tasks = [
    { taskId: "task-1", title: "Low priority backup", priority: 1 },
    { taskId: "task-2", title: "Critical security patch", priority: 10 },
    { taskId: "task-3", title: "Medium priority update", priority: 5 },
    { taskId: "task-4", title: "Default priority cleanup", priority: 0 },
    { taskId: "task-5", title: "Normal maintenance", priority: 3 },
  ];

  for (const task of tasks) {
    const now = new Date().toISOString();

    await client
      .publish(
        "submitTask",
        {
          taskId: task.taskId,
          title: task.title,
          priority: task.priority,
          createdAt: now,
        },
        {
          // Set RabbitMQ message priority
          priority: task.priority,
        },
      )
      .tapError((error) => logger.error({ error, task }, "Failed to publish task"))
      .tapOk(() =>
        logger.info(
          `📤 Published: ${task.taskId} - "${task.title}" (priority: ${task.priority})`,
        ),
      )
      .resultToPromise();

    // Small delay to ensure messages are queued
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info("");
  logger.info("✅ All tasks published successfully");
  logger.info("👀 Start the worker to see tasks processed in priority order");
  logger.info("");

  // Close client
  await client.close().resultToPromise();
  logger.info("✅ Client closed");
}

main().catch((error) => {
  logger.error({ error }, "Fatal error");
  process.exit(1);
});
