import type {
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import type {
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlers,
} from "./types.js";

/**
 * Define a type-safe handler for a specific consumer in a contract.
 *
 * This utility allows you to define handlers outside of the worker creation,
 * providing better code organization and reusability.
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The async handler function that processes messages
 * @returns A type-safe handler that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineHandler } from '@amqp-contract/worker';
 * import { orderContract } from './contract';
 *
 * // Define handler outside of worker creation
 * const processOrderHandler = defineHandler(
 *   orderContract,
 *   'processOrder',
 *   async (message) => {
 *     // message is fully typed based on the contract
 *     console.log('Processing order:', message.orderId);
 *     await processPayment(message);
 *   }
 * );
 *
 * // Use the handler in worker
 * const worker = await TypedAmqpWorker.create({
 *   contract: orderContract,
 *   handlers: {
 *     processOrder: processOrderHandler,
 *   },
 *   connection: 'amqp://localhost',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Define multiple handlers
 * const processOrderHandler = defineHandler(
 *   orderContract,
 *   'processOrder',
 *   async (message) => {
 *     await processOrder(message);
 *   }
 * );
 *
 * const notifyOrderHandler = defineHandler(
 *   orderContract,
 *   'notifyOrder',
 *   async (message) => {
 *     await sendNotification(message);
 *   }
 * );
 *
 * // Compose handlers
 * const worker = await TypedAmqpWorker.create({
 *   contract: orderContract,
 *   handlers: {
 *     processOrder: processOrderHandler,
 *     notifyOrder: notifyOrderHandler,
 *   },
 *   connection: 'amqp://localhost',
 * });
 * ```
 */
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerHandler<TContract, TName>,
): WorkerInferConsumerHandler<TContract, TName> {
  // Validate that the consumer exists in the contract
  const consumers = contract.consumers as Record<string, unknown> | undefined;
  if (!consumers || !((consumerName as string) in consumers)) {
    const availableConsumers = consumers ? Object.keys(consumers) : [];
    const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
    throw new Error(
      `Consumer "${String(consumerName)}" not found in contract. Available consumers: ${available}`,
    );
  }

  // Return the handler as-is, with type checking enforced
  return handler;
}

/**
 * Define multiple type-safe handlers for consumers in a contract.
 *
 * This utility allows you to define all handlers at once outside of the worker creation,
 * ensuring type safety and providing better code organization.
 *
 * @template TContract - The contract definition type
 * @param contract - The contract definition containing the consumers
 * @param handlers - An object with async handler functions for each consumer
 * @returns A type-safe handlers object that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineHandlers } from '@amqp-contract/worker';
 * import { orderContract } from './contract';
 *
 * // Define all handlers at once
 * const handlers = defineHandlers(orderContract, {
 *   processOrder: async (message) => {
 *     // message is fully typed based on the contract
 *     console.log('Processing order:', message.orderId);
 *     await processPayment(message);
 *   },
 *   notifyOrder: async (message) => {
 *     await sendNotification(message);
 *   },
 *   shipOrder: async (message) => {
 *     await prepareShipment(message);
 *   },
 * });
 *
 * // Use the handlers in worker
 * const worker = await TypedAmqpWorker.create({
 *   contract: orderContract,
 *   handlers,
 *   connection: 'amqp://localhost',
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Separate handler definitions for better organization
 * async function handleProcessOrder(message: WorkerInferConsumerInput<typeof orderContract, 'processOrder'>) {
 *   await processOrder(message);
 * }
 *
 * async function handleNotifyOrder(message: WorkerInferConsumerInput<typeof orderContract, 'notifyOrder'>) {
 *   await sendNotification(message);
 * }
 *
 * const handlers = defineHandlers(orderContract, {
 *   processOrder: handleProcessOrder,
 *   notifyOrder: handleNotifyOrder,
 * });
 * ```
 */
export function defineHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: WorkerInferConsumerHandlers<TContract>,
): WorkerInferConsumerHandlers<TContract> {
  // Validate that all consumers in handlers exist in the contract
  const consumers = contract.consumers as Record<string, unknown> | undefined;
  const availableConsumers = consumers ? Object.keys(consumers) : [];

  for (const handlerName of Object.keys(handlers)) {
    if (!consumers || !(handlerName in consumers)) {
      const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
      throw new Error(
        `Consumer "${handlerName}" not found in contract. Available consumers: ${available}`,
      );
    }
  }

  // Return the handlers as-is, with type checking enforced
  return handlers;
}
