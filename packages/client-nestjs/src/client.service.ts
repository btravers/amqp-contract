import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Options } from "amqplib";
import { Future, Result } from "@swan-io/boxed";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
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
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions;
}

/**
 * Type-safe AMQP client service for NestJS
 * This service integrates @amqp-contract/client with NestJS lifecycle
 */
@Injectable()
export class AmqpClientService<TContract extends ContractDefinition>
  implements OnModuleInit, OnModuleDestroy
{
  private client: TypedAmqpClient<TContract> | null = null;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AmqpClientModuleOptions<TContract>,
  ) {}

  /**
   * Initialize the client when the NestJS module starts
   */
  async onModuleInit(): Promise<void> {
    const createOptions: { contract: TContract; urls: ConnectionUrl[]; connectionOptions?: AmqpConnectionManagerOptions } = {
      contract: this.options.contract,
      urls: this.options.urls,
    };
    if (this.options.connectionOptions !== undefined) {
      createOptions.connectionOptions = this.options.connectionOptions;
    }
    this.client = TypedAmqpClient.create(createOptions);
  }

  /**
   * Close the client when the NestJS module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close().resultToPromise();
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
