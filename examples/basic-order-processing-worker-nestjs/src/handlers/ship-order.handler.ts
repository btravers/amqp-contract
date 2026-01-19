import { Future, Result } from "@swan-io/boxed";
import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumedMessage } from "@amqp-contract/worker";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class ShipOrderHandler {
  private readonly logger = new Logger(ShipOrderHandler.name);

  handleMessage = ({ payload }: WorkerInferConsumedMessage<typeof orderContract, "shipOrder">) => {
    this.logger.log(
      `[SHIPPING] Shipment notification received: ${payload.orderId} -> ${payload.status}`,
    );
    this.logger.log(`Shipping label prepared for order ${payload.orderId}`);
    return Future.value(Result.Ok(undefined));
  };

  handler = defineHandler(orderContract, "shipOrder", (message) => this.handleMessage(message));
}
