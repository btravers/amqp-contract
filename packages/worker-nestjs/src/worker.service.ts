import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { ContractDefinition } from "@amqp-contract/contract";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import { TypedAmqpWorker, type WorkerInferConsumerHandlers } from "@amqp-contract/worker";
import { MODULE_OPTIONS_TOKEN } from "./worker.module-definition.js";

/**
 * Options for creating a NestJS worker service
 */
export interface AmqpWorkerModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
}

/**
 * Type-safe AMQP worker service for NestJS
 * This service integrates @amqp-contract/worker with NestJS lifecycle
 */
@Injectable()
export class AmqpWorkerService<TContract extends ContractDefinition>
  implements OnModuleInit, OnModuleDestroy
{
  private worker: TypedAmqpWorker<TContract> | null = null;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AmqpWorkerModuleOptions<TContract>,
  ) {}

  /**
   * Initialize the worker when the NestJS module starts
   */
  async onModuleInit(): Promise<void> {
    this.worker = await TypedAmqpWorker.create(this.options).resultToPromise();
  }

  /**
   * Close the worker when the NestJS module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close().resultToPromise();
      this.worker = null;
    }
  }
}
