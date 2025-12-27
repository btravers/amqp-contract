import { defineHandler } from "@amqp-contract/worker";
import { Logger } from "@nestjs/common";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

const logger = new Logger("NotifyOrderHandler");

export const notifyOrderHandler = defineHandler(orderContract, "notifyOrder", async (message) => {
  // Check if it's a new order or a status update
  if ("items" in message) {
    // It's a full order
    logger.log(
      `[NOTIFICATIONS] New order event received: ${message.orderId} for customer ${message.customerId}`,
    );
  } else {
    // It's a status update
    logger.log(`[NOTIFICATIONS] Status update received: ${message.orderId} -> ${message.status}`);
  }

  // Simulate sending notification
  await new Promise((resolve) => setTimeout(resolve, 300));

  logger.debug("Notification sent");
});
