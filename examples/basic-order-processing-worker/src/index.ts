import { RetryableError, TypedAmqpWorker, defineHandlers } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";
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
  // Create type-safe worker with handlers for each consumer
  const worker = await TypedAmqpWorker.create({
    contract: orderContract,
    handlers: defineHandlers(orderContract, {
      // Handler for processing NEW orders (order.created)
      processOrder: ({ payload }) => {
        logger.info(
          {
            orderId: payload.orderId,
            customerId: payload.customerId,
            items: payload.items.length,
            total: payload.totalAmount,
          },
          "[PROCESSING] New order received",
        );

        return Future.fromPromise(new Promise<void>((resolve) => setTimeout(resolve, 500)))
          .mapOk(() => {
            logger.info({ orderId: payload.orderId }, "Order processed successfully");
          })
          .mapError((e) => new RetryableError("Processing failed", e));
      },

      // Handler for ALL order notifications (order.#)
      notifyOrder: ({ payload }) => {
        // Check if it's a new order or a status update
        if ("items" in payload) {
          // It's a full order
          logger.info(
            {
              type: "new_order",
              orderId: payload.orderId,
              customerId: payload.customerId,
            },
            "[NOTIFICATIONS] Event received",
          );
        } else {
          // It's a status update
          logger.info(
            {
              type: "status_update",
              orderId: payload.orderId,
              status: payload.status,
            },
            "[NOTIFICATIONS] Event received",
          );
        }

        return Future.fromPromise(new Promise<void>((resolve) => setTimeout(resolve, 300)))
          .mapOk(() => {
            logger.info("Notification sent");
          })
          .mapError((e) => new RetryableError("Notification failed", e));
      },

      // Handler for SHIPPED orders (order.shipped)
      shipOrder: ({ payload }) => {
        logger.info(
          {
            orderId: payload.orderId,
            status: payload.status,
          },
          "[SHIPPING] Shipment notification received",
        );

        return Future.fromPromise(new Promise<void>((resolve) => setTimeout(resolve, 400)))
          .mapOk(() => {
            logger.info({ orderId: payload.orderId }, "Shipping label prepared");
          })
          .mapError((e) => new RetryableError("Shipping failed", e));
      },

      // Handler for URGENT orders (order.*.urgent)
      handleUrgentOrder: ({ payload }) => {
        logger.warn(
          {
            orderId: payload.orderId,
            status: payload.status,
          },
          "[URGENT] Priority order update received!",
        );

        return Future.fromPromise(new Promise<void>((resolve) => setTimeout(resolve, 200)))
          .mapOk(() => {
            logger.warn({ orderId: payload.orderId }, "Urgent update handled");
          })
          .mapError((e) => new RetryableError("Urgent handling failed", e));
      },

      // Handler for FAILED orders (from dead letter exchange)
      handleFailedOrders: ({ payload }) => {
        logger.error(
          {
            orderId: payload.orderId,
            customerId: payload.customerId,
            totalAmount: payload.totalAmount,
          },
          "[DLX] Failed order received from dead letter exchange",
        );

        return Future.fromPromise(new Promise<void>((resolve) => setTimeout(resolve, 200)))
          .mapOk(() => {
            logger.error({ orderId: payload.orderId }, "Failed order logged for investigation");
          })
          .mapError((e) => new RetryableError("Failed order handling failed", e));
      },
    }),
    urls: [env.AMQP_URL],
  })
    .tapError((error) => logger.error({ error }, "Failed to create worker"))
    .resultToPromise();

  logger.info("Worker ready, waiting for messages...");
  logger.info("=".repeat(60));
  logger.info("Subscribed to:");
  logger.info("  • order.created     → processOrder handler");
  logger.info("  • order.#           → notifyOrder handler (all events)");
  logger.info("  • order.shipped     → shipOrder handler");
  logger.info("  • order.*.urgent    → handleUrgentOrder handler");
  logger.info("  • order.failed (via DLX) → handleFailedOrders handler");
  logger.info("=".repeat(60));
  logger.info("Dead Letter Exchange:");
  logger.info("  order-processing → orders-dlx (routing: order.failed)");
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
