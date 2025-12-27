import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumerInput } from "@amqp-contract/worker";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class ShipOrderHandler {
  private readonly logger = new Logger(ShipOrderHandler.name);

  async handle(message: WorkerInferConsumerInput<typeof orderContract, "shipOrder">): Promise<void> {
    this.logger.log(
      `[SHIPPING] Shipment notification received: ${message.orderId} -> ${message.status}`,
    );
    this.logger.log(`Shipping label prepared for order ${message.orderId}`);
  }

  handler = defineHandler(orderContract, "shipOrder", (message) => this.handle(message));
}
