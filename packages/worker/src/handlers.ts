import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import type {
  WorkerInferConsumerBatchHandler,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlerEntry,
  WorkerInferConsumerHandlers,
} from "./types.js";

/**
 * Define a type-safe handler for a specific consumer in a contract.
 *
 * This utility allows you to define handlers outside of the worker creation,
 * providing better code organization and reusability.
 *
 * Supports three patterns:
 * 1. Simple handler: just the function (single message handler)
 * 2. Handler with prefetch: [handler, { prefetch: 10 }] (single message handler with config)
 * 3. Batch handler: [batchHandler, { batchSize: 5, batchTimeout: 1000 }] (REQUIRES batchSize config)
 *
 * **Important**: Batch handlers (handlers that accept an array of messages) MUST include
 * batchSize configuration. You cannot create a batch handler without specifying batchSize.
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The async handler function that processes messages (single or batch)
 * @param options - Optional consumer options (prefetch, batchSize, batchTimeout)
 *   - For single-message handlers: { prefetch?: number } is optional
 *   - For batch handlers: { batchSize: number, batchTimeout?: number } is REQUIRED
 * @returns A type-safe handler that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineHandler } from '@amqp-contract/worker';
 * import { orderContract } from './contract';
 *
 * // Simple single-message handler without options
 * const processOrderHandler = defineHandler(
 *   orderContract,
 *   'processOrder',
 *   async (message) => {
 *     console.log('Processing order:', message.orderId);
 *     await processPayment(message);
 *   }
 * );
 *
 * // Single-message handler with prefetch
 * const processOrderWithPrefetch = defineHandler(
 *   orderContract,
 *   'processOrder',
 *   async (message) => {
 *     await processOrder(message);
 *   },
 *   { prefetch: 10 }
 * );
 *
 * // Batch handler - MUST include batchSize
 * const processBatchOrders = defineHandler(
 *   orderContract,
 *   'processOrders',
 *   async (messages) => {
 *     // messages is an array - batchSize configuration is REQUIRED
 *     await db.insertMany(messages);
 *   },
 *   { batchSize: 5, batchTimeout: 1000 }
 * );
 * ```
 */
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerHandler<TContract, TName>,
): WorkerInferConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerHandler<TContract, TName>,
  options: { prefetch?: number; batchSize?: never; batchTimeout?: never },
): WorkerInferConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerBatchHandler<TContract, TName>,
  options: { prefetch?: number; batchSize: number; batchTimeout?: number },
): WorkerInferConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler:
    | WorkerInferConsumerHandler<TContract, TName>
    | WorkerInferConsumerBatchHandler<TContract, TName>,
  options?: { prefetch?: number; batchSize?: number; batchTimeout?: number },
): WorkerInferConsumerHandlerEntry<TContract, TName> {
  // Validate that the consumer exists in the contract
  const consumers = contract.consumers;

  if (!consumers || !(consumerName in consumers)) {
    const availableConsumers = consumers ? Object.keys(consumers) : [];
    const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
    throw new Error(
      `Consumer "${String(consumerName)}" not found in contract. Available consumers: ${available}`,
    );
  }

  // Return the handler with options if provided, otherwise just the handler
  if (options) {
    return [handler, options] as WorkerInferConsumerHandlerEntry<TContract, TName>;
  }
  return handler as WorkerInferConsumerHandlerEntry<TContract, TName>;
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
  const consumers = contract.consumers;
  const availableConsumers = Object.keys(consumers ?? {});
  const availableConsumerNames =
    availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";

  for (const handlerName of Object.keys(handlers)) {
    if (!consumers || !(handlerName in consumers)) {
      throw new Error(
        `Consumer "${handlerName}" not found in contract. Available consumers: ${availableConsumerNames}`,
      );
    }
  }

  // Return the handlers as-is, with type checking enforced
  return handlers;
}
