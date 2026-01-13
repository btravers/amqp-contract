import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumedMessage } from "@amqp-contract/worker";
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class HandleUrgentOrderHandler {
  private readonly logger = new Logger(HandleUrgentOrderHandler.name);

  handleMessage = async ({
    payload,
  }: WorkerInferConsumedMessage<typeof orderContract, "handleUrgentOrder">) => {
    this.logger.warn(`[URGENT] Priority order update received: ${payload.orderId} -> ${payload.status}`);
    this.logger.warn(`Urgent update handled for order ${payload.orderId}`);
  };

  handler = defineUnsafeHandler(orderContract, "handleUrgentOrder", async (message) =>
    this.handleMessage(message),
  );
}
