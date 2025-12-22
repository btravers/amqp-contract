import { ConfigurableModuleBuilder, Module } from "@nestjs/common";
import type { AmqpClientModuleOptions } from "./client.service.js";
import { AmqpClientService } from "./client.service.js";

/**
 * ConfigurableModuleBuilder for AMQP client module
 * This creates forRoot and forRootAsync methods automatically
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  AmqpClientModuleOptions<any>
>()
  .setClassMethodName("forRoot")
  .build();

/**
 * NestJS module for AMQP client integration
 * This module provides type-safe AMQP client functionality using @amqp-contract/client
 * without relying on NestJS decorators (except for dependency injection)
 */
@Module({
  providers: [AmqpClientService],
  exports: [AmqpClientService],
})
export class AmqpClientModule extends ConfigurableModuleClass {}
