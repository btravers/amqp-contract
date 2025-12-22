import { Module } from "@nestjs/common";
import { ConfigurableModuleClass } from "./client.module-definition.js";
import { AmqpClientService } from "./client.service.js";

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
