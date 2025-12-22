import { Module } from "@nestjs/common";
import { ConfigurableModuleClass } from "./worker.module-definition.js";
import { AmqpWorkerService } from "./worker.service.js";

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
