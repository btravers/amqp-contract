import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumerInput } from "@amqp-contract/worker";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class HandleFailedOrdersHandler {
  private readonly logger = new Logger(HandleFailedOrdersHandler.name);

  async handle(
    message: WorkerInferConsumerInput<typeof orderContract, "handleFailedOrders">,
  ): Promise<void> {
    this.logger.error(`[DLX] Failed order received from dead letter exchange: ${message.orderId}`);
    this.logger.debug(
      `Failed order details: customer ${message.customerId}, total: $${message.totalAmount}`,
    );
    // Implement retry logic, alert, or store for manual processing
    this.logger.error(`Failed order ${message.orderId} logged for investigation`);
  }

  handler = defineHandler(orderContract, "handleFailedOrders", (message) => this.handle(message));
}
