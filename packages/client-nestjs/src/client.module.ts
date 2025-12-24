import {
  Module,
  type DynamicModule,
  type Provider,
  type Type,
  type ModuleMetadata,
} from "@nestjs/common";
import type { ContractDefinition } from "@amqp-contract/contract";
import { MODULE_OPTIONS_TOKEN } from "./client.module-definition.js";
import { AmqpClientService, type AmqpClientModuleOptions } from "./client.service.js";

/**
 * Factory function return type for async module configuration
 */
type AmqpClientModuleOptionsFactory<TContract extends ContractDefinition> =
  | AmqpClientModuleOptions<TContract>
  | Promise<AmqpClientModuleOptions<TContract>>;

/**
 * Options for async module configuration using factory pattern
 */
export interface AmqpClientModuleAsyncOptions<TContract extends ContractDefinition> {
  /**
   * Factory function that returns the module options.
   * Can use injected dependencies to create configuration.
   */
  // oxlint-disable-next-line no-explicit-any
  useFactory: (...args: any[]) => AmqpClientModuleOptionsFactory<TContract>;
  /**
   * Optional dependencies to inject into the factory function.
   * Can be a token (string/symbol) or a class reference to a provider.
   */
  inject?: (string | symbol | Type<unknown>)[];
  /**
   * Optional list of imported modules that export providers needed by the factory
   */
  imports?: ModuleMetadata["imports"];
}

/**
 * NestJS module for AMQP client integration
 * This module provides type-safe AMQP client functionality using @amqp-contract/client
 * without relying on NestJS decorators (except for dependency injection)
 *
 * @typeParam TContract - The contract definition type for type-safe publishing
 *
 * @example
 * ```typescript
 * // Synchronous configuration
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
 * // Asynchronous configuration
 * @Module({
 *   imports: [
 *     AmqpClientModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (configService: ConfigService) => ({
 *         contract: myContract,
 *         urls: configService.get('AMQP_URLS')
 *       }),
 *       inject: [ConfigService]
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // Using the client in a service
 * @Injectable()
 * export class OrderService {
 *   constructor(
 *     private readonly amqpClient: AmqpClientService<typeof myContract>
 *   ) {}
 *
 *   async createOrder(order: Order) {
 *     // publish is fully typed based on the contract
 *     await this.amqpClient.publish('orderCreated', {
 *       orderId: order.id,
 *       amount: order.total
 *     }).resultToPromise();
 *   }
 * }
 * ```
 */
@Module({})
export class AmqpClientModule {
  /**
   * Register the AMQP client module with synchronous configuration
   *
   * @param options - The client configuration options with contract
   * @returns A dynamic module for NestJS
   */
  static forRoot<TContract extends ContractDefinition>(
    options: AmqpClientModuleOptions<TContract>,
  ): DynamicModule {
    return {
      module: AmqpClientModule,
      providers: [
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },
        AmqpClientService,
      ],
      exports: [AmqpClientService],
    };
  }

  /**
   * Register the AMQP client module with asynchronous configuration
   *
   * @param options - Async configuration options with factory function
   * @returns A dynamic module for NestJS
   */
  static forRootAsync<TContract extends ContractDefinition>(
    options: AmqpClientModuleAsyncOptions<TContract>,
  ): DynamicModule {
    const providers: Provider[] = [
      {
        provide: MODULE_OPTIONS_TOKEN,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      AmqpClientService,
    ];

    return {
      module: AmqpClientModule,
      imports: options.imports || [],
      providers,
      exports: [AmqpClientService],
    };
  }
}
