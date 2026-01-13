import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumedMessage } from "@amqp-contract/worker";
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class NotifyOrderHandler {
  private readonly logger = new Logger(NotifyOrderHandler.name);

  handleMessage = async ({
    payload,
  }: WorkerInferConsumedMessage<typeof orderContract, "notifyOrder">) => {
    // Check if it's a new order or a status update
    if ("items" in payload) {
      // It's a full order
      this.logger.log(
        `[NOTIFICATIONS] New order event received: ${payload.orderId} for customer ${payload.customerId}`,
      );
    } else {
      // It's a status update
      this.logger.log(
        `[NOTIFICATIONS] Status update received: ${payload.orderId} -> ${payload.status}`,
      );
    }
    this.logger.debug("Notification sent");
  };

  handler = defineUnsafeHandler(orderContract, "notifyOrder", async (message) =>
    this.handleMessage(message),
  );
}
