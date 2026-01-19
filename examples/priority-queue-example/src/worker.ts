import { RetryableError, TypedAmqpWorker, defineHandlers } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";
import pino from "pino";
import { priorityQueueContract } from "./contract.js";
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
  logger.info("Priority Queue Demo - Worker");
  logger.info("=".repeat(60));

  // Create type-safe worker with task handler
  const worker = await TypedAmqpWorker.create({
    contract: priorityQueueContract,
    urls: [env.AMQP_URL],
    handlers: defineHandlers(priorityQueueContract, {
      processTask: ({ payload }) => {
        // Simulate task processing
        logger.info(
          `📥 Processing: ${payload.taskId} - "${payload.title}" (priority: ${payload.priority})`,
        );

        return Future.fromPromise(new Promise<void>((resolve) => setTimeout(resolve, 500)))
          .mapOk(() => {
            logger.info(`✅ Completed: ${payload.taskId}`);
          })
          .mapError((e) => new RetryableError("Task processing failed", e));
      },
    }),
  })
    .tapError((error) => logger.error({ error }, "Failed to create worker"))
    .resultToPromise();

  logger.info("✅ Worker ready and waiting for tasks...");
  logger.info("💡 Tasks will be processed in priority order (highest first)");
  logger.info("");

  // Keep worker running
  process.on("SIGINT", async () => {
    logger.info("");
    logger.info("⏸️  Shutting down gracefully...");
    await worker.close().resultToPromise();
    logger.info("✅ Worker closed");
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, "Fatal error");
  process.exit(1);
});
