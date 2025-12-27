import { defineHandler } from "@amqp-contract/worker";
import { Logger } from "@nestjs/common";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

const logger = new Logger("HandleUrgentOrderHandler");

export const handleUrgentOrderHandler = defineHandler(
  orderContract,
  "handleUrgentOrder",
  async (message) => {
    logger.warn(`[URGENT] Priority order update received: ${message.orderId} -> ${message.status}`);

    // Simulate urgent processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    logger.warn(`Urgent update handled for order ${message.orderId}`);
  },
);
