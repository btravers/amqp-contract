import { ConfigurableModuleBuilder } from "@nestjs/common";
import type { ContractDefinition } from "@amqp-contract/contract";
import type { AmqpWorkerModuleOptions } from "./worker.service.js";

/**
 * ConfigurableModuleBuilder for AMQP worker module
 * This creates forRoot and forRootAsync methods automatically
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<
  AmqpWorkerModuleOptions<ContractDefinition>
>()
  .setClassMethodName("forRoot")
  .build();
