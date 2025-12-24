import { TypedAmqpWorker } from "@amqp-contract/worker";
import pino from "pino";
import { z } from "zod";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { allHandlers } from "./handlers.js";

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
  // Create type-safe worker with handlers defined externally
  // This demonstrates better code organization and reusability
  const workerResult = await TypedAmqpWorker.create({
    contract: orderContract,
    handlers: allHandlers, // Using handlers defined in handlers.ts
    urls: [env.AMQP_URL],
  });

  if (workerResult.isError()) {
    logger.error({ error: workerResult.error }, "Failed to create worker");
    throw workerResult.error;
  }

  const worker = workerResult.value;

  logger.info("Worker ready, waiting for messages...");
  logger.info("=".repeat(60));
  logger.info("Subscribed to:");
  logger.info("  • order.created     → processOrder handler");
  logger.info("  • order.#           → notifyOrder handler (all events)");
  logger.info("  • order.shipped     → shipOrder handler");
  logger.info("  • order.*.urgent    → handleUrgentOrder handler");
  logger.info("  • order.# (via analytics exchange) → processAnalytics handler");
  logger.info("=".repeat(60));
  logger.info("Exchange-to-Exchange Binding:");
  logger.info("  orders → order-analytics (routing: order.#)");
  logger.info("=".repeat(60));
  logger.info("Note: This example uses handlers defined in handlers.ts");
  logger.info("=".repeat(60));

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down worker...");
    await worker.close().resultToPromise();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, "Worker error");
  process.exit(1);
});
