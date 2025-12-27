import { Injectable, Logger } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class ShipOrderUseCase {
  private readonly logger = new Logger(ShipOrderUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  async execute(orderId: string) {
    const result = await this.amqpClient.publish("orderShipped", {
      orderId,
      status: "shipped",
      updatedAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish shipment for ${orderId}`, result.error);
      throw result.error;
    }

    this.logger.log(`Published shipment for ${orderId}`);
    return { success: true };
  }
}
