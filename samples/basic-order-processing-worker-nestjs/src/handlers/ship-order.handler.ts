import { Injectable, Logger } from "@nestjs/common";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class ShipOrderHandler {
  private readonly logger = new Logger(ShipOrderHandler.name);

  handler = defineHandler(orderContract, "shipOrder", async (message) => {
    this.logger.log(`[SHIPPING] Shipment notification received: ${message.orderId} -> ${message.status}`);
    this.logger.log(`Shipping label prepared for order ${message.orderId}`);
  });
}
