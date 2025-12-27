import { defineHandler } from "@amqp-contract/worker";
import { Logger } from "@nestjs/common";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

const logger = new Logger("ShipOrderHandler");

export const shipOrderHandler = defineHandler(orderContract, "shipOrder", async (message) => {
  logger.log(`[SHIPPING] Shipment notification received: ${message.orderId} -> ${message.status}`);

  // Simulate shipping preparation
  await new Promise((resolve) => setTimeout(resolve, 400));

  logger.log(`Shipping label prepared for order ${message.orderId}`);
});
