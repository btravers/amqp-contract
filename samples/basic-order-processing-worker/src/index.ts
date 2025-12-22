import { TypedAmqpWorker } from "@amqp-contract/worker";
import pino from "pino";
import { z } from "zod";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

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
    handlers: {
      // Handler for processing NEW orders (order.created)
      processOrder: async (message) => {
        logger.info(
          {
            orderId: message.orderId,
            customerId: message.customerId,
            items: message.items.length,
            total: message.totalAmount,
          },
          "[PROCESSING] New order received",
        );

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 500));

        logger.info({ orderId: message.orderId }, "Order processed successfully");
      },

      // Handler for ALL order notifications (order.#)
      notifyOrder: async (message) => {
        // Check if it's a new order or a status update
        if ("items" in message) {
          // It's a full order
          logger.info(
            {
              type: "new_order",
              orderId: message.orderId,
              customerId: message.customerId,
            },
            "[NOTIFICATIONS] Event received",
          );
        } else {
          // It's a status update
          logger.info(
            {
              type: "status_update",
              orderId: message.orderId,
              status: message.status,
            },
            "[NOTIFICATIONS] Event received",
          );
        }

        // Simulate sending notification
        await new Promise((resolve) => setTimeout(resolve, 300));

        logger.info("Notification sent");
      },

      // Handler for SHIPPED orders (order.shipped)
      shipOrder: async (message) => {
        logger.info(
          {
            orderId: message.orderId,
            status: message.status,
          },
          "[SHIPPING] Shipment notification received",
        );

        // Simulate shipping preparation
        await new Promise((resolve) => setTimeout(resolve, 400));

        logger.info({ orderId: message.orderId }, "Shipping label prepared");
      },

      // Handler for URGENT orders (order.*.urgent)
      handleUrgentOrder: async (message) => {
        logger.warn(
          {
            orderId: message.orderId,
            status: message.status,
          },
          "[URGENT] Priority order update received!",
        );

        // Simulate urgent processing
        await new Promise((resolve) => setTimeout(resolve, 200));

        logger.warn({ orderId: message.orderId }, "Urgent update handled");
      },

      // Handler for ANALYTICS processing (receives events through exchange-to-exchange binding)
      processAnalytics: async (message) => {
        // Check if it's a new order or a status update
        if ("items" in message) {
          // It's a full order
          logger.info(
            {
              type: "analytics",
              orderId: message.orderId,
              customerId: message.customerId,
              totalAmount: message.totalAmount,
            },
            "[ANALYTICS] New order data received via exchange-to-exchange binding",
          );
        } else {
          // It's a status update
          logger.info(
            {
              type: "analytics",
              orderId: message.orderId,
              status: message.status,
            },
            "[ANALYTICS] Status update received via exchange-to-exchange binding",
          );
        }

        // Simulate analytics processing
        await new Promise((resolve) => setTimeout(resolve, 100));

        logger.info("Analytics data processed");
      },
    },
    connection: env.AMQP_URL,
  });

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

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down worker...");
    await worker.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error({ error }, "Worker error");
  process.exit(1);
});
