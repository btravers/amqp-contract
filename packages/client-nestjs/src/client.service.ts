import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { ChannelModel } from "amqplib";
import type {
  ClientInferPublisherInput,
  ContractDefinition,
  InferPublisherNames,
} from "@amqp-contract/contract";
import { TypedAmqpClient, type PublishOptions } from "@amqp-contract/client";

/**
 * Options for creating a NestJS client service
 */
export interface AmqpClientModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  connection: ChannelModel;
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

  constructor(private readonly options: AmqpClientModuleOptions<TContract>) {}

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
   * This method provides type-safe message publishing
   */
  async publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions,
  ): Promise<boolean> {
    if (!this.client) {
      throw new Error(
        "Client not initialized. Ensure the module has been initialized before publishing.",
      );
    }

    return this.client.publish(publisherName, message, options);
  }

  /**
   * Get the underlying TypedAmqpClient instance
   */
  getClient(): TypedAmqpClient<TContract> | null {
    return this.client;
  }
}
