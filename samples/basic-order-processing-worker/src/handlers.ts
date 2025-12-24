import { defineHandler, defineHandlers } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import pino from "pino";

const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

/**
 * Example: Define individual handlers separately for better code organization
 */

// Define handler for processing NEW orders (order.created)
export const processOrderHandler = defineHandler(orderContract, "processOrder", async (message) => {
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
});

// Define handler for ALL order notifications (order.#)
export const notifyOrderHandler = defineHandler(orderContract, "notifyOrder", async (message) => {
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
});

// Define handler for SHIPPED orders (order.shipped)
export const shipOrderHandler = defineHandler(orderContract, "shipOrder", async (message) => {
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
});

// Define handler for URGENT orders (order.*.urgent)
export const handleUrgentOrderHandler = defineHandler(
  orderContract,
  "handleUrgentOrder",
  async (message) => {
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
);

// Define handler for ANALYTICS processing
export const processAnalyticsHandler = defineHandler(
  orderContract,
  "processAnalytics",
  async (message) => {
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
);

/**
 * Example: Define all handlers at once using defineHandlers
 */
export const allHandlers = defineHandlers(orderContract, {
  processOrder: processOrderHandler,
  notifyOrder: notifyOrderHandler,
  shipOrder: shipOrderHandler,
  handleUrgentOrder: handleUrgentOrderHandler,
  processAnalytics: processAnalyticsHandler,
});
