import { Future, Result } from "@swan-io/boxed";
import { Injectable, Logger } from "@nestjs/common";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

export type CreateOrderInput = {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  totalAmount: number;
};

@Injectable()
export class CreateOrderUseCase {
  private readonly logger = new Logger(CreateOrderUseCase.name);

  constructor(
    private readonly amqpClient: AmqpClientService<typeof orderContract>,
  ) {}

  execute(
    order: CreateOrderInput,
  ): Future<Result<{ success: true }, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing order ${order.orderId}`);

    return this.amqpClient
      .publish("orderCreated", {
        ...order,
        createdAt: new Date().toISOString(),
      })
      .map((result) => {
        return result.mapOk(() => {
          this.logger.log(`Published order ${order.orderId}`);
          return { success: true as const };
        });
      });
  }
}
