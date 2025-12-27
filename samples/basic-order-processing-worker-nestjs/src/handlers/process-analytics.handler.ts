import { defineHandler } from "@amqp-contract/worker";
import { Logger } from "@nestjs/common";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

const logger = new Logger("ProcessAnalyticsHandler");

export const processAnalyticsHandler = defineHandler(
  orderContract,
  "processAnalytics",
  async (message) => {
    // Check if it's a new order or a status update
    if ("items" in message) {
      // It's a full order
      logger.log(
        `[ANALYTICS] New order data received via exchange-to-exchange binding: ${message.orderId}`,
      );
      logger.debug(`Analytics: ${message.items.length} items, total: $${message.totalAmount}`);
    } else {
      // It's a status update
      logger.log(
        `[ANALYTICS] Status update received via exchange-to-exchange binding: ${message.orderId} -> ${message.status}`,
      );
    }

    // Simulate analytics processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.debug("Analytics data processed");
  },
);
