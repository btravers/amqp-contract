import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumedMessage } from "@amqp-contract/worker";
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class ShipOrderHandler {
  private readonly logger = new Logger(ShipOrderHandler.name);

  handleMessage = async (
    message: WorkerInferConsumedMessage<typeof orderContract, "shipOrder">,
  ) => {
    this.logger.log(
      `[SHIPPING] Shipment notification received: ${message.payload.orderId} -> ${message.payload.status}`,
    );
    this.logger.log(`Shipping label prepared for order ${message.payload.orderId}`);
  };

  handler = defineUnsafeHandler(orderContract, "shipOrder", async (message) =>
    this.handleMessage(message),
  );
}
