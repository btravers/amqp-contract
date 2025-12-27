import { Future, Result } from "@swan-io/boxed";
import { Injectable, Logger } from "@nestjs/common";
import type { MessageValidationError, TechnicalError } from "@amqp-contract/client-nestjs";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import type { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

@Injectable()
export class UpdateOrderStatusUseCase {
  private readonly logger = new Logger(UpdateOrderStatusUseCase.name);

  constructor(private readonly amqpClient: AmqpClientService<typeof orderContract>) {}

  execute(
    orderId: string,
    status: "processing" | "shipped" | "delivered" | "cancelled",
  ): Future<Result<void, TechnicalError | MessageValidationError>> {
    this.logger.log(`Publishing status update for ${orderId}: ${status}`);

    return this.amqpClient
      .publish("orderUpdated", {
        orderId,
        status,
        updatedAt: new Date().toISOString(),
      })
      .tapOk(() => {
        this.logger.log(`Published status update for ${orderId}: ${status}`);
      });
  }
}
