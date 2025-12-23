import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Options } from "amqplib";
import { Future, Result } from "@swan-io/boxed";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import {
  MessageValidationError,
  TechnicalError,
  TypedAmqpClient,
  type ClientInferPublisherInput,
} from "@amqp-contract/client";
import { MODULE_OPTIONS_TOKEN } from "./client.module-definition.js";

/**
 * Options for creating a NestJS client service
 */
export interface AmqpClientModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  connection: string | Options.Connect;
}

/**
 * Type-safe AMQP client service for NestJS
 * This service integrates @amqp-contract/client with NestJS lifecycle
 */
@Injectable()
export class AmqpClientService<TContract extends ContractDefinition>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AmqpClientService.name);
  private client: TypedAmqpClient<TContract> | null = null;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AmqpClientModuleOptions<TContract>,
  ) {}

  /**
   * Initialize the client when the NestJS module starts
   */
  async onModuleInit(): Promise<void> {
    const clientResult = await TypedAmqpClient.create({
      contract: this.options.contract,
      connection: this.options.connection,
    }).toPromise();
    
    if (clientResult.isError()) {
      this.logger.error("Failed to create AMQP client", clientResult.getError());
      throw clientResult.getError();
    }
    
    this.client = clientResult.value;
  }

  /**
   * Close the client when the NestJS module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      const result = await this.client.close().toPromise();
      if (result.isError()) {
        // Log the error but don't throw to avoid disrupting shutdown
        this.logger.error("Failed to close AMQP client", result.getError());
      }
      this.client = null;
    }
  }

  /**
   * Publish a message using a defined publisher
   * This method provides type-safe message publishing with explicit error handling
   * Returns Future<Result<boolean, ClientError>> for runtime errors
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: Options.Publish,
  ): Future<Result<boolean, TechnicalError | MessageValidationError>> {
    if (!this.client) {
      return Future.value(
        Result.Error(
          new TechnicalError(
            "Client not initialized. Ensure the module has been initialized before publishing.",
          ),
        ),
      );
    }

    return this.client.publish(publisherName, message, options);
  }
}
