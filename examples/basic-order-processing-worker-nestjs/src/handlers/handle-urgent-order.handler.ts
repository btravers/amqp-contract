import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumerInput } from "@amqp-contract/worker";
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class HandleUrgentOrderHandler {
  private readonly logger = new Logger(HandleUrgentOrderHandler.name);

  handleMessage = async (
    message: WorkerInferConsumerInput<typeof orderContract, "handleUrgentOrder">,
  ) => {
    this.logger.warn(
      `[URGENT] Priority order update received: ${message.orderId} -> ${message.status}`,
    );
    this.logger.warn(`Urgent update handled for order ${message.orderId}`);
  };

  handler = defineUnsafeHandler(orderContract, "handleUrgentOrder", async (message) =>
    this.handleMessage(message),
  );
}
