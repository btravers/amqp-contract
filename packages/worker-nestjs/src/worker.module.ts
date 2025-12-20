import { DynamicModule, Module } from "@nestjs/common";
import type { ChannelModel } from "amqplib";
import type { ContractDefinition, WorkerInferConsumerHandlers } from "@amqp-contract/contract";
import { AmqpWorkerService } from "./worker.service.js";
import type { AmqpWorkerModuleOptions } from "./worker.service.js";

/**
 * Options for creating the AMQP worker module
 */
export interface CreateAmqpWorkerModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  connection: ChannelModel;
}

/**
 * NestJS module for AMQP worker integration
 * This module provides type-safe AMQP worker functionality using @amqp-contract/worker
 * without relying on NestJS decorators (except for dependency injection)
 */
@Module({})
export class AmqpWorkerModule {
  /**
   * Create a dynamic NestJS module for AMQP worker
   * This method allows for type-safe worker configuration without decorators
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     AmqpWorkerModule.forRoot({
   *       contract: myContract,
   *       handlers: {
   *         myConsumer: async (message) => {
   *           console.log('Received:', message);
   *         },
   *       },
   *       connection: amqpConnection,
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot<TContract extends ContractDefinition>(
    options: CreateAmqpWorkerModuleOptions<TContract>,
  ): DynamicModule {
    const workerOptions: AmqpWorkerModuleOptions<TContract> = {
      contract: options.contract,
      handlers: options.handlers,
      connection: options.connection,
    };

    return {
      module: AmqpWorkerModule,
      providers: [
        {
          provide: AmqpWorkerService,
          useFactory: () => new AmqpWorkerService(workerOptions),
        },
      ],
      exports: [AmqpWorkerService],
    };
  }
}
