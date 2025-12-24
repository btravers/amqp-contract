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
 * Configuration options for the AMQP client NestJS module.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * const options: AmqpClientModuleOptions<typeof contract> = {
 *   contract: myContract,
 *   urls: ['amqp://localhost'],
 *   connectionOptions: {
 *     heartbeatIntervalInSeconds: 30
 *   }
 * };
 * ```
 */
export interface AmqpClientModuleOptions<TContract extends ContractDefinition> {
  /** The AMQP contract definition specifying publishers and their message schemas */
  contract: TContract;
  /** AMQP broker URL(s). Multiple URLs provide failover support */
  urls: ConnectionUrl[];
  /** Optional connection configuration (heartbeat, reconnect settings, etc.) */
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
}

/**
 * Type-safe AMQP client service for NestJS applications.
 *
 * This service wraps {@link TypedAmqpClient} and integrates it with the NestJS
 * lifecycle, automatically initializing the connection on module init and
 * cleaning up resources on module destroy.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * // In your module
 * import { AmqpClientModule } from '@amqp-contract/client-nestjs';
 *
 * @Module({
 *   imports: [
 *     AmqpClientModule.forRoot({
 *       contract: myContract,
 *       urls: ['amqp://localhost']
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // In your service
 * import { AmqpClientService } from '@amqp-contract/client-nestjs';
 *
 * @Injectable()
 * export class OrderService {
 *   constructor(
 *     private readonly amqpClient: AmqpClientService<typeof myContract>
 *   ) {}
 *
 *   async createOrder(order: Order) {
 *     const result = await this.amqpClient.publish('orderCreated', {
 *       orderId: order.id,
 *       amount: order.total
 *     }).resultToPromise();
 *
 *     if (result.isError()) {
 *       throw new Error('Failed to publish order event');
 *     }
 *   }
 * }
 * ```
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
   * Initialize the AMQP client when the NestJS module starts.
   *
   * This lifecycle hook automatically creates and initializes the client
   * when the NestJS application starts up. The connection will be established
   * in the background with automatic reconnection handling.
   */
  async onModuleInit(): Promise<void> {
    this.client = TypedAmqpClient.create(this.options);
  }

  /**
   * Close the AMQP client when the NestJS module is destroyed.
   *
   * This lifecycle hook ensures proper cleanup of resources when the
   * NestJS application shuts down, gracefully closing the connection
   * and cleaning up all consumers.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close().resultToPromise();
      this.client = null;
    }
  }

  /**
   * Publish a message using a contract-defined publisher.
   *
   * This method provides type-safe message publishing with automatic validation
   * and explicit error handling through the Result type.
   *
   * @param publisherName - The name of the publisher from the contract
   * @param message - The message payload (type-checked against the contract)
   * @param options - Optional AMQP publish options (e.g., persistence, headers)
   * @returns A Future that resolves to a Result indicating success or failure
   *
   * @example
   * ```typescript
   * const result = await this.amqpClient.publish('orderCreated', {
   *   orderId: '123',
   *   amount: 99.99
   * }).resultToPromise();
   *
   * if (result.isError()) {
   *   console.error('Publish failed:', result.error);
   * }
   * ```
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
