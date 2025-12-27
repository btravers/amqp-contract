import { Injectable, Logger } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class UrgentUpdateUseCase {
  private readonly logger = new Logger(UrgentUpdateUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  async execute(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ) {
    const result = await this.amqpClient.publish("orderUrgentUpdate", {
      orderId,
      status,
      updatedAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish urgent update for ${orderId}`, result.error);
      throw result.error;
    }

    this.logger.warn(`Published urgent update for ${orderId}: ${status}`);
    return { success: true };
  }
}
