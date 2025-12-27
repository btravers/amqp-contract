import { Inject, Injectable, Logger } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import type { Future, Result } from "@swan-io/boxed";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client";

@Injectable()
export class ShipOrderUseCase {
  private readonly logger = new Logger(ShipOrderUseCase.name);

  constructor(
    @Inject(AmqpClientService) private readonly amqpClient: AmqpClientService<typeof orderContract>,
  ) {}

  execute(orderId: string): Future<Result<{ success: true }, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing shipment for ${orderId}`);

    return this.amqpClient
      .publish("orderShipped", {
        orderId,
        status: "shipped" as const,
        updatedAt: new Date().toISOString(),
      })
      .map((result) => {
        return result.mapOk(() => {
          this.logger.log(`Published shipment for ${orderId}`);
          return { success: true as const };
        });
      });
  }
}
