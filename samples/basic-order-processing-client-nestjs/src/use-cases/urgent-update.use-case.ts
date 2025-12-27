import { Future, Result } from "@swan-io/boxed";
import { Injectable, Logger } from "@nestjs/common";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client-nestjs";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class UrgentUpdateUseCase {
  private readonly logger = new Logger(UrgentUpdateUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  execute(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ): Future<Result<{ success: true }, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing urgent update for ${orderId}: ${status}`);

    return this.amqpClient
      .publish("orderUrgentUpdate", {
        orderId,
        status,
        updatedAt: new Date().toISOString(),
      })
      .map((result) => {
        return result.mapOk(() => {
          this.logger.log(`Published urgent update for ${orderId}: ${status}`);
          return { success: true as const };
        });
      });
  }
}
