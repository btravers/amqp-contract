import { Future, Result } from "@swan-io/boxed";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client-nestjs";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class UrgentUpdateUseCase {
  private readonly logger = new Logger(UrgentUpdateUseCase.name);

  constructor(
    @Inject(AmqpClientService) private readonly amqpClient: AmqpClientService<typeof orderContract>,
  ) {}

  execute(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ): Future<Result<void, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing urgent update for ${orderId}: ${status}`);

    return this.amqpClient
      .publish("orderUrgentUpdate", {
        orderId,
        status,
        updatedAt: new Date().toISOString(),
      })
      .tapOk(() => {
        this.logger.log(`Published urgent update for ${orderId}: ${status}`);
      });
  }
}
