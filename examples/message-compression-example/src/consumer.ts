import { TypedAmqpWorker, defineUnsafeHandlers } from "@amqp-contract/worker";
import { contract } from "./contract.js";
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
  logger.info("Starting consumer - will automatically decompress messages");
  logger.info("=".repeat(70));

  // Create type-safe worker
  const worker = await TypedAmqpWorker.create({
    contract,
    handlers: defineUnsafeHandlers(contract, {
      processData: async ({ payload }) => {
        // Message is automatically decompressed by the worker
        // You receive the original, validated data structure
        const messageSize = JSON.stringify(payload).length;

        logger.info("📨 Received message:");
        logger.info(`   ID: ${payload.id}`);
        logger.info(`   Timestamp: ${payload.timestamp}`);
        logger.info(`   Items count: ${payload.items.length}`);
        logger.info(`   Decompressed size: ${messageSize} bytes`);
        logger.info(`   → Message was automatically decompressed if needed`);
        logger.info(`   → No configuration required on consumer side`);
        logger.info("");
      },
    }),
    urls: [env.AMQP_URL],
  })
    .tapError((error) => logger.error({ error }, "Failed to create worker"))
    .resultToPromise();

  logger.info("✅ Consumer ready - waiting for messages...");
  logger.info("   Press Ctrl+C to stop");
  logger.info("=".repeat(70));
  logger.info("");

  // Keep the worker running
  await new Promise((resolve) => {
    process.on("SIGINT", async () => {
      logger.info("");
      logger.info("Shutting down consumer...");
      await worker.close();
      logger.info("Consumer stopped");
      resolve(undefined);
    });
  });

  process.exit(0);
}

main().catch((error) => {
  logger.error({ error }, "Consumer error");
  process.exit(1);
});
