import {
  Module,
  type DynamicModule,
  type Provider,
  type Type,
  type ModuleMetadata,
} from "@nestjs/common";
import type { ContractDefinition } from "@amqp-contract/contract";
import { MODULE_OPTIONS_TOKEN } from "./worker.module-definition.js";
import { AmqpWorkerService, type AmqpWorkerModuleOptions } from "./worker.service.js";

/**
 * Factory function return type for async module configuration
 */
type AmqpWorkerModuleOptionsFactory<TContract extends ContractDefinition> =
  | AmqpWorkerModuleOptions<TContract>
  | Promise<AmqpWorkerModuleOptions<TContract>>;

/**
 * Options for async module configuration using factory pattern
 */
export interface AmqpWorkerModuleAsyncOptions<TContract extends ContractDefinition> {
  /**
   * Factory function that returns the module options.
   * Can use injected dependencies to create configuration.
   */
  // oxlint-disable-next-line no-explicit-any
  useFactory: (...args: any[]) => AmqpWorkerModuleOptionsFactory<TContract>;
  /**
   * Optional dependencies to inject into the factory function.
   * Can be a token (string/symbol) a class or a reference to a provider.
   */
  inject?: (string | symbol | Type<unknown>)[];
  /**
   * Optional list of imported modules that export providers needed by the factory
   */
  imports?: ModuleMetadata["imports"];
}

/**
 * NestJS module for AMQP worker integration
 * This module provides type-safe AMQP worker functionality using @amqp-contract/worker
 * without relying on NestJS decorators (except for dependency injection)
 *
 * @typeParam TContract - The contract definition type for type-safe handlers
 *
 * @example
 * ```typescript
 * // Synchronous configuration
 * @Module({
 *   imports: [
 *     AmqpWorkerModule.forRoot({
 *       contract: myContract,
 *       handlers: {
 *         processOrder: async (message) => {
 *           // message is fully typed based on the contract
 *           console.log('Order:', message.orderId);
 *         }
 *       },
 *       urls: ['amqp://localhost']
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // Asynchronous configuration
 * @Module({
 *   imports: [
 *     AmqpWorkerModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (configService: ConfigService) => ({
 *         contract: myContract,
 *         handlers: {
 *           processOrder: async (message) => {
 *             console.log('Order:', message.orderId);
 *           }
 *         },
 *         urls: configService.get('AMQP_URLS')
 *       }),
 *       inject: [ConfigService]
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class AmqpWorkerModule {
  /**
   * Register the AMQP worker module with synchronous configuration
   *
   * @param options - The worker configuration options with contract and handlers
   * @returns A dynamic module for NestJS
   */
  static forRoot<TContract extends ContractDefinition>(
    options: AmqpWorkerModuleOptions<TContract>,
  ): DynamicModule {
    return {
      module: AmqpWorkerModule,
      providers: [
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
        AmqpWorkerService,
      ],
      exports: [AmqpWorkerService],
    };
  }

  /**
   * Register the AMQP worker module with asynchronous configuration
   *
   * @param options - Async configuration options with factory function
   * @returns A dynamic module for NestJS
   */
  static forRootAsync<TContract extends ContractDefinition>(
    options: AmqpWorkerModuleAsyncOptions<TContract>,
  ): DynamicModule {
    const providers: Provider[] = [
      {
        provide: MODULE_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      AmqpWorkerService,
    ];

    return {
      module: AmqpWorkerModule,
      imports: options.imports || [],
      providers,
      exports: [AmqpWorkerService],
    };
  }
}
