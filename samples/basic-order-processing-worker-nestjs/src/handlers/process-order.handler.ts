import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumerInput } from "@amqp-contract/worker";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class ProcessOrderHandler {
  private readonly logger = new Logger(ProcessOrderHandler.name);

  handleMessage = async (message: WorkerInferConsumerInput<typeof orderContract, "processOrder">) => {
    this.logger.log(
      `[PROCESSING] New order received: ${message.orderId} for customer ${message.customerId}`,
    );
    this.logger.debug(
      `Order details: ${message.items.length} items, total: $${message.totalAmount}`,
    );
    this.logger.log(`Order ${message.orderId} processed successfully`);
  };

  handler = defineHandler(orderContract, "processOrder", async (message) => this.handleMessage(message));
}
