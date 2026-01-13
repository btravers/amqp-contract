import { Injectable, Logger } from "@nestjs/common";
import type { WorkerInferConsumedMessage } from "@amqp-contract/worker";
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class ProcessAnalyticsHandler {
  private readonly logger = new Logger(ProcessAnalyticsHandler.name);

  handleMessage = async ({
    payload,
  }: WorkerInferConsumedMessage<typeof orderContract, "processAnalytics">) => {
    // Check if it's a new order or a status update
    if ("items" in payload) {
      // It's a full order
      this.logger.log(
        `[ANALYTICS] New order data received via exchange-to-exchange binding: ${payload.orderId}`,
      );
      this.logger.debug(`Analytics: ${payload.items.length} items, total: $${payload.totalAmount}`);
    } else {
      // It's a status update
      this.logger.log(
        `[ANALYTICS] Status update received via exchange-to-exchange binding: ${payload.orderId} -> ${payload.status}`,
      );
    }
    this.logger.debug("Analytics data processed");
  };

  handler = defineUnsafeHandler(orderContract, "processAnalytics", async (message) =>
    this.handleMessage(message),
  );
}
