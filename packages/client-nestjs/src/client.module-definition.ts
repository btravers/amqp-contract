import { ConfigurableModuleBuilder } from "@nestjs/common";
import type { AmqpClientModuleOptions } from "./client.service.js";

/**
 * ConfigurableModuleBuilder for AMQP client module
 * This creates forRoot and forRootAsync methods automatically
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<
  // oxlint-disable-next-line  @typescript-eslint/no-explicit-any
  AmqpClientModuleOptions<any>
>()
  .setClassMethodName("forRoot")
  .build();
