import { ConfigurableModuleBuilder } from "@nestjs/common";
import type { ContractDefinition } from "@amqp-contract/contract";
import type { AmqpClientModuleOptions } from "./client.service.js";

/**
 * ConfigurableModuleBuilder for AMQP client module
 * This creates forRoot and forRootAsync methods automatically
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<
  AmqpClientModuleOptions<ContractDefinition>
>()
  .setClassMethodName("forRoot")
  .build();
