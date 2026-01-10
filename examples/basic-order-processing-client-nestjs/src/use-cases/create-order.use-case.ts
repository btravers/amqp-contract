import { Future, Result } from "@swan-io/boxed";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client-nestjs";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

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
    @Inject(AmqpClientService) private readonly amqpClient: AmqpClientService<typeof orderContract>,
  ) {}

  execute(order: CreateOrderInput): Future<Result<void, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing order ${order.orderId}`);

    return this.amqpClient
      .publish("orderCreated", {
        ...order,
        createdAt: new Date().toISOString(),
      })
      .tapOk(() => {
        this.logger.log(`Published order ${order.orderId}`);
      });
  }
}
