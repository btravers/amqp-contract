import { Injectable, Logger } from "@nestjs/common";
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

@Injectable()
export class HandleFailedOrdersHandler {
  private readonly logger = new Logger(HandleFailedOrdersHandler.name);

  handler = defineUnsafeHandler(orderContract, "handleFailedOrders", async ({ payload }) => {
    this.logger.error(`[DLX] Failed order received from dead letter exchange: ${payload.orderId}`);
    this.logger.debug(
      `Failed order details: customer ${payload.customerId}, total: $${payload.totalAmount}`,
    );
    // Implement retry logic, alert, or store for manual processing
    this.logger.error(`Failed order ${payload.orderId} logged for investigation`);
  });
}
