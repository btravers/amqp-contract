import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Options } from "amqplib";
import { Result } from "@swan-io/boxed";
import type {
  ContractDefinition,
  InferPublisherNames,
} from "@amqp-contract/contract";
import {
  MessageValidationError,
  TechnicalError,
  TypedAmqpClient,
  type PublishOptions,
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
  private client: TypedAmqpClient<TContract> | null = null;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AmqpClientModuleOptions<TContract>,
  ) {}

  /**
   * Initialize the client when the NestJS module starts
   */
  async onModuleInit(): Promise<void> {
    this.client = await TypedAmqpClient.create({
      contract: this.options.contract,
      connection: this.options.connection,
    });
  }

  /**
   * Close the client when the NestJS module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Publish a message using a defined publisher
   * This method provides type-safe message publishing with explicit error handling
   * Returns Result<boolean, ClientError> for runtime errors
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions,
  ): Result<boolean, TechnicalError | MessageValidationError> {
    if (!this.client) {
      return Result.Error(
        new TechnicalError(
          "Client not initialized. Ensure the module has been initialized before publishing.",
        ),
      );
    }

    return this.client.publish(publisherName, message, options);
  }
}
