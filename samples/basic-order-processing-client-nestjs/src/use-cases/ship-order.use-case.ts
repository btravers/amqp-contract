import { Future, Result } from "@swan-io/boxed";
import { Injectable, Logger } from "@nestjs/common";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client-nestjs";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class ShipOrderUseCase {
  private readonly logger = new Logger(ShipOrderUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  execute(orderId: string): Future<Result<void, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing shipment for ${orderId}`);

    return this.amqpClient
      .publish("orderShipped", {
        orderId,
        status: "shipped" as const,
        updatedAt: new Date().toISOString(),
      })
      .tapOk(() => {
        this.logger.log(`Published shipment for ${orderId}`);
      });
  }
}
