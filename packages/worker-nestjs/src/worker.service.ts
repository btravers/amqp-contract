import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { TypedAmqpWorker, type WorkerInferSafeConsumerHandlers } from "@amqp-contract/worker";
import type { ContractDefinition } from "@amqp-contract/contract";
import { MODULE_OPTIONS_TOKEN } from "./worker.module-definition.js";

/**
 * Configuration options for the AMQP worker NestJS module.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * import { defineHandlers, defineUnsafeHandlers } from '@amqp-contract/worker';
 * import { Future, Result } from '@swan-io/boxed';
 * import { RetryableError } from '@amqp-contract/worker';
 *
 * // Using safe handlers (recommended)
 * const options: AmqpWorkerModuleOptions<typeof contract> = {
 *   contract: myContract,
 *   handlers: defineHandlers(myContract, {
 *     processOrder: (message) =>
 *       Future.fromPromise(processPayment(message))
 *         .mapOk(() => Result.Ok(undefined))
 *         .mapError((error) => Result.Error(new RetryableError('Payment failed', error)))
 *   }),
 *   urls: ['amqp://localhost'],
 * };
 *
 * // Using unsafe handlers (legacy)
 * const options: AmqpWorkerModuleOptions<typeof contract> = {
 *   contract: myContract,
 *   handlers: defineUnsafeHandlers(myContract, {
 *     processOrder: async (message) => {
 *       console.log('Processing order:', message.orderId);
 *     }
 *   }),
 *   urls: ['amqp://localhost'],
 * };
 * ```
 */
export type AmqpWorkerModuleOptions<TContract extends ContractDefinition> = {
  /** The AMQP contract definition specifying consumers and their message schemas */
  contract: TContract;
  /** Message handlers for each consumer defined in the contract. Use defineHandlers or defineUnsafeHandlers to create type-safe handlers. */
  handlers: WorkerInferSafeConsumerHandlers<TContract>;
  /** AMQP broker URL(s). Multiple URLs provide failover support */
  urls: ConnectionUrl[];
  /** Optional connection configuration (heartbeat, reconnect settings, etc.) */
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
};

/**
 * Type-safe AMQP worker service for NestJS applications.
 *
 * This service wraps {@link TypedAmqpWorker} and integrates it with the NestJS
 * lifecycle, automatically starting message consumption on module init and
 * cleaning up resources on module destroy.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * // In your module
 * import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
 *
 * @Module({
 *   imports: [
 *     AmqpWorkerModule.forRoot({
 *       contract: myContract,
 *       handlers: {
 *         processOrder: async (message) => {
 *           console.log('Received order:', message.orderId);
 *           // Process the order...
 *         }
 *       },
 *       urls: ['amqp://localhost']
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // The worker automatically starts consuming messages when the module initializes
 * // and stops gracefully when the application shuts down
 * ```
 */
@Injectable()
export class AmqpWorkerService<TContract extends ContractDefinition>
  implements OnModuleInit, OnModuleDestroy
{
  private worker: TypedAmqpWorker<TContract> | null = null;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AmqpWorkerModuleOptions<TContract>,
  ) {}

  /**
   * Initialize the AMQP worker when the NestJS module starts.
   *
   * This lifecycle hook automatically creates and starts the worker,
   * beginning message consumption from all configured consumers.
   * The connection will be established in the background with
   * automatic reconnection handling.
   *
   * @throws Error if the worker fails to start
   */
  async onModuleInit(): Promise<void> {
    this.worker = await TypedAmqpWorker.create(this.options).resultToPromise();
  }

  /**
   * Close the AMQP worker when the NestJS module is destroyed.
   *
   * This lifecycle hook ensures proper cleanup of resources when the
   * NestJS application shuts down, gracefully stopping message consumption
   * and closing the connection.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close().resultToPromise();
      this.worker = null;
    }
  }
}
