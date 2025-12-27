import { Injectable, Logger } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

export interface CreateOrderInput {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  totalAmount: number;
}

@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  async execute(order: CreateOrderInput) {
    const result = await this.amqpClient.publish("orderCreated", {
      ...order,
      createdAt: new Date().toISOString(),
    });

    if (result.isError()) {
      this.logger.error(`Failed to publish order ${order.orderId}`, result.error);
      throw result.error;
    }

    this.logger.log(`Published order ${order.orderId}`);
    return { success: true };
  }
}
