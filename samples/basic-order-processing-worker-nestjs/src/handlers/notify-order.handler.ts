import { Injectable, Logger } from "@nestjs/common";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class NotifyOrderHandler {
  private readonly logger = new Logger(NotifyOrderHandler.name);

  handler = defineHandler(orderContract, "notifyOrder", async (message) => {
    // Check if it's a new order or a status update
    if ("items" in message) {
      // It's a full order
      this.logger.log(
        `[NOTIFICATIONS] New order event received: ${message.orderId} for customer ${message.customerId}`,
      );
    } else {
      // It's a status update
      this.logger.log(`[NOTIFICATIONS] Status update received: ${message.orderId} -> ${message.status}`);
    }
    this.logger.debug("Notification sent");
  });
}
