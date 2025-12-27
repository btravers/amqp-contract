import { Injectable, Logger } from "@nestjs/common";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class HandleUrgentOrderHandler {
  private readonly logger = new Logger(HandleUrgentOrderHandler.name);

  handler = defineHandler(orderContract, "handleUrgentOrder", async (message) => {
    this.logger.warn(
      `[URGENT] Priority order update received: ${message.orderId} -> ${message.status}`,
    );
    this.logger.warn(`Urgent update handled for order ${message.orderId}`);
  });
}
