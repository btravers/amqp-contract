import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class ProcessAnalyticsHandler {
  private readonly logger = new Logger(ProcessAnalyticsHandler.name);

  handler = defineHandler(orderContract, "processAnalytics", async (message) => {
    // Check if it's a new order or a status update
    if ("items" in message) {
      // It's a full order
      this.logger.log(
        `[ANALYTICS] New order data received via exchange-to-exchange binding: ${message.orderId}`,
      );
      this.logger.debug(`Analytics: ${message.items.length} items, total: $${message.totalAmount}`);
    } else {
      // It's a status update
      this.logger.log(
        `[ANALYTICS] Status update received via exchange-to-exchange binding: ${message.orderId} -> ${message.status}`,
      );
    }
    this.logger.debug("Analytics data processed");
  });
}
