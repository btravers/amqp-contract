import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { Logger } from "@nestjs/common";

const logger = new Logger("ProcessOrderHandler");

export const processOrderHandler = defineHandler(orderContract, "processOrder", async (message) => {
  logger.log(
    `[PROCESSING] New order received: ${message.orderId} for customer ${message.customerId}`,
  );
  logger.debug(`Order details: ${message.items.length} items, total: $${message.totalAmount}`);

  // Simulate processing
  await new Promise((resolve) => setTimeout(resolve, 500));

  logger.log(`Order ${message.orderId} processed successfully`);
});
