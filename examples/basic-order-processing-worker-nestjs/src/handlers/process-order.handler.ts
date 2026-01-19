import { Future, Result } from "@swan-io/boxed";
import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumedMessage } from "@amqp-contract/worker";
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class ProcessOrderHandler {
  private readonly logger = new Logger(ProcessOrderHandler.name);

  handleMessage = ({
    payload,
  }: WorkerInferConsumedMessage<typeof orderContract, "processOrder">) => {
    this.logger.log(
      `[PROCESSING] New order received: ${payload.orderId} for customer ${payload.customerId}`,
    );
    this.logger.debug(
      `Order details: ${payload.items.length} items, total: $${payload.totalAmount}`,
    );
    this.logger.log(`Order ${payload.orderId} processed successfully`);
    return Future.value(Result.Ok(undefined));
  };

  handler = defineHandler(orderContract, "processOrder", (message) => this.handleMessage(message));
}
