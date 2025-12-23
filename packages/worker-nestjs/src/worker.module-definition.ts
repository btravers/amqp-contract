import { ConfigurableModuleBuilder } from "@nestjs/common";
import type { AmqpWorkerModuleOptions } from "./worker.service.js";

/**
 * ConfigurableModuleBuilder for AMQP worker module
 * This creates forRoot and forRootAsync methods automatically
 */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<
  // oxlint-disable-next-line  @typescript-eslint/no-explicit-any
  AmqpWorkerModuleOptions<any>
>()
  .setClassMethodName("forRoot")
  .build();
