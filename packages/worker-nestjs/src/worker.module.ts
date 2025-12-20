import { ConfigurableModuleBuilder, Module } from "@nestjs/common";
import type { AmqpWorkerModuleOptions } from "./worker.service.js";
import { AmqpWorkerService } from "./worker.service.js";

/**
 * ConfigurableModuleBuilder for AMQP worker module
 * This creates forRoot and forRootAsync methods automatically
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<
  AmqpWorkerModuleOptions<never>
>()
  .setClassMethodName("forRoot")
  .build();

/**
 * NestJS module for AMQP worker integration
 * This module provides type-safe AMQP worker functionality using @amqp-contract/worker
 * without relying on NestJS decorators (except for dependency injection)
 */
@Module({
  providers: [AmqpWorkerService],
  exports: [AmqpWorkerService],
})
export class AmqpWorkerModule extends ConfigurableModuleClass {}
