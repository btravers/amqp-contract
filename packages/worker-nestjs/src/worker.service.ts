import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { ChannelModel } from "amqplib";
import type { ContractDefinition, WorkerInferConsumerHandlers } from "@amqp-contract/contract";
import { TypedAmqpWorker } from "@amqp-contract/worker";

/**
 * Options for creating a NestJS worker service
 */
export interface AmqpWorkerModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  connection: ChannelModel;
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

  constructor(private readonly options: AmqpWorkerModuleOptions<TContract>) {}

  /**
   * Initialize the worker when the NestJS module starts
   */
  async onModuleInit(): Promise<void> {
    this.worker = await TypedAmqpWorker.create({
      contract: this.options.contract,
      handlers: this.options.handlers,
      connection: this.options.connection,
    });
  }

  /**
   * Close the worker when the NestJS module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  /**
   * Get the underlying TypedAmqpWorker instance
   */
  getWorker(): TypedAmqpWorker<TContract> | null {
    return this.worker;
  }
}
