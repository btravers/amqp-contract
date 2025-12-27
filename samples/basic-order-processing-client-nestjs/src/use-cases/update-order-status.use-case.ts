import { Injectable, Logger } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class UpdateOrderStatusUseCase {
  private readonly logger = new Logger(UpdateOrderStatusUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  async execute(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ) {
    const result = await this.amqpClient.publish("orderUpdated", {
      orderId,
      status,
      updatedAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish order update for ${orderId}`, result.error);
      throw result.error;
    }

    this.logger.log(`Published order update for ${orderId}: ${status}`);
    return { success: true };
  }
}
