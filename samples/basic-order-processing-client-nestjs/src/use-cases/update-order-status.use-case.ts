import { Inject, Injectable, Logger } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import type { Future, Result } from "@swan-io/boxed";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client";

@Injectable()
export class UpdateOrderStatusUseCase {
  private readonly logger = new Logger(UpdateOrderStatusUseCase.name);

  constructor(
    @Inject(AmqpClientService) private readonly amqpClient: AmqpClientService<typeof orderContract>,
  ) {}

  execute(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ): Future<Result<{ success: true }, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing status update for ${orderId}: ${status}`);

    return this.amqpClient
      .publish("orderUpdated", {
        orderId,
        status,
        updatedAt: new Date().toISOString(),
      })
      .map((result) => {
        return result.mapOk(() => {
          this.logger.log(`Published status update for ${orderId}: ${status}`);
          return { success: true as const };
        });
      });
  }
}
