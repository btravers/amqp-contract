import { DynamicModule, Module } from "@nestjs/common";
import type { ChannelModel } from "amqplib";
import type { ContractDefinition } from "@amqp-contract/contract";
import { AmqpClientService } from "./client.service.js";
import type { AmqpClientModuleOptions } from "./client.service.js";

/**
 * Options for creating the AMQP client module
 */
export interface CreateAmqpClientModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  connection: ChannelModel;
}

/**
 * NestJS module for AMQP client integration
 * This module provides type-safe AMQP client functionality using @amqp-contract/client
 * without relying on NestJS decorators (except for dependency injection)
 */
@Module({})
export class AmqpClientModule {
  /**
   * Create a dynamic NestJS module for AMQP client
   * This method allows for type-safe client configuration without decorators
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     AmqpClientModule.forRoot({
   *       contract: myContract,
   *       connection: amqpConnection,
   *     }),
   *   ],
   * })
   * export class AppModule {}
   * ```
   */
  static forRoot<TContract extends ContractDefinition>(
    options: CreateAmqpClientModuleOptions<TContract>,
  ): DynamicModule {
    const clientOptions: AmqpClientModuleOptions<TContract> = {
      contract: options.contract,
      connection: options.connection,
    };

    return {
      module: AmqpClientModule,
      providers: [
        {
          provide: AmqpClientService,
          useFactory: () => new AmqpClientService(clientOptions),
        },
      ],
      exports: [AmqpClientService],
    };
  }
}
