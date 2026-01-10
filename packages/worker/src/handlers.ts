import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import type {
  WorkerInferSafeConsumerBatchHandler,
  WorkerInferSafeConsumerHandler,
  WorkerInferSafeConsumerHandlerEntry,
  WorkerInferSafeConsumerHandlers,
  WorkerInferUnsafeConsumerBatchHandler,
  WorkerInferUnsafeConsumerHandler,
  WorkerInferUnsafeConsumerHandlerEntry,
  WorkerInferUnsafeConsumerHandlers,
} from "./types.js";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate that a consumer exists in the contract
 */
function validateConsumerExists<TContract extends ContractDefinition>(
  contract: TContract,
  consumerName: string,
): void {
  const consumers = contract.consumers;

  if (!consumers || !(consumerName in consumers)) {
    const availableConsumers = consumers ? Object.keys(consumers) : [];
    const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
    throw new Error(
      `Consumer "${consumerName}" not found in contract. Available consumers: ${available}`,
    );
  }
}

/**
 * Validate that all handlers reference valid consumers
 */
function validateHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: Record<string, unknown>,
): void {
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
}

// =============================================================================
// Safe Handler Definitions (Recommended)
// =============================================================================

/**
 * Define a type-safe handler for a specific consumer in a contract.
 *
 * **Recommended:** This function creates handlers that return `Future<Result<void, HandlerError>>`,
 * providing explicit error handling and better control over retry behavior.
 *
 * Supports three patterns:
 * 1. Simple handler: just the function (single message handler)
 * 2. Handler with prefetch: [handler, { prefetch: 10 }] (single message handler with config)
 * 3. Batch handler: [batchHandler, { batchSize: 5, batchTimeout: 1000 }] (REQUIRES batchSize config)
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The handler function that returns Future<Result<void, HandlerError>>
 * @param options - Optional consumer options (prefetch, batchSize, batchTimeout)
 * @returns A type-safe handler that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineHandler, RetryableError, NonRetryableError } from '@amqp-contract/worker';
 * import { Future, Result } from '@swan-io/boxed';
 * import { orderContract } from './contract';
 *
 * // Simple handler with explicit error handling
 * const processOrderHandler = defineHandler(
 *   orderContract,
 *   'processOrder',
 *   (message) => {
 *     try {
 *       await processPayment(message);
 *       return Future.value(Result.Ok(undefined));
 *     } catch (error) {
 *       // Explicit error type - will be retried
 *       return Future.value(Result.Error(new RetryableError('Payment service unavailable', error)));
 *     }
 *   }
 * );
 *
 * // Handler with validation (non-retryable error)
 * const validateOrderHandler = defineHandler(
 *   orderContract,
 *   'validateOrder',
 *   (message) => {
 *     if (message.amount <= 0) {
 *       // Won't be retried - goes directly to DLQ
 *       return Future.value(Result.Error(new NonRetryableError('Invalid order amount')));
 *     }
 *     return Future.value(Result.Ok(undefined));
 *   }
 * );
 * ```
 */
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferSafeConsumerHandler<TContract, TName>,
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferSafeConsumerHandler<TContract, TName>,
  options: { prefetch?: number; batchSize?: never; batchTimeout?: never },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferSafeConsumerBatchHandler<TContract, TName>,
  options: { prefetch?: number; batchSize: number; batchTimeout?: number },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler:
    | WorkerInferSafeConsumerHandler<TContract, TName>
    | WorkerInferSafeConsumerBatchHandler<TContract, TName>,
  options?: { prefetch?: number; batchSize?: number; batchTimeout?: number },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName> {
  validateConsumerExists(contract, String(consumerName));

  if (options) {
    return [handler, options] as WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
  }
  return handler as WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
}

/**
 * Define multiple type-safe handlers for consumers in a contract.
 *
 * **Recommended:** This function creates handlers that return `Future<Result<void, HandlerError>>`,
 * providing explicit error handling and better control over retry behavior.
 *
 * @template TContract - The contract definition type
 * @param contract - The contract definition containing the consumers
 * @param handlers - An object with handler functions for each consumer
 * @returns A type-safe handlers object that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineHandlers, RetryableError, NonRetryableError } from '@amqp-contract/worker';
 * import { Future, Result } from '@swan-io/boxed';
 * import { orderContract } from './contract';
 *
 * const handlers = defineHandlers(orderContract, {
 *   processOrder: (message) => {
 *     try {
 *       await processPayment(message);
 *       return Future.value(Result.Ok(undefined));
 *     } catch (error) {
 *       return Future.value(Result.Error(new RetryableError('Failed', error)));
 *     }
 *   },
 *   notifyOrder: (message) => {
 *     await sendNotification(message);
 *     return Future.value(Result.Ok(undefined));
 *   },
 * });
 * ```
 */
export function defineHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: WorkerInferSafeConsumerHandlers<TContract>,
): WorkerInferSafeConsumerHandlers<TContract> {
  validateHandlers(contract, handlers as unknown as Record<string, unknown>);
  return handlers;
}

// =============================================================================
// Unsafe Handler Definitions (Legacy)
// =============================================================================

/**
 * Define an unsafe handler for a specific consumer in a contract.
 *
 * @deprecated Use `defineHandler` instead for explicit error handling with Future<Result>.
 *
 * **Warning:** Unsafe handlers use exception-based error handling:
 * - All thrown errors are treated as retryable by default
 * - Harder to reason about which errors should be retried
 * - May lead to unexpected retry behavior
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The async handler function that processes messages
 * @param options - Optional consumer options (prefetch, batchSize, batchTimeout)
 * @returns A type-safe handler that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineUnsafeHandler } from '@amqp-contract/worker';
 *
 * // ⚠️ Consider using defineHandler for better error handling
 * const processOrderHandler = defineUnsafeHandler(
 *   orderContract,
 *   'processOrder',
 *   async (message) => {
 *     // Throws on error - will be retried
 *     await processPayment(message);
 *   }
 * );
 * ```
 */
export function defineUnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferUnsafeConsumerHandler<TContract, TName>,
): WorkerInferUnsafeConsumerHandlerEntry<TContract, TName>;
export function defineUnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferUnsafeConsumerHandler<TContract, TName>,
  options: { prefetch?: number; batchSize?: never; batchTimeout?: never },
): WorkerInferUnsafeConsumerHandlerEntry<TContract, TName>;
export function defineUnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferUnsafeConsumerBatchHandler<TContract, TName>,
  options: { prefetch?: number; batchSize: number; batchTimeout?: number },
): WorkerInferUnsafeConsumerHandlerEntry<TContract, TName>;
export function defineUnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler:
    | WorkerInferUnsafeConsumerHandler<TContract, TName>
    | WorkerInferUnsafeConsumerBatchHandler<TContract, TName>,
  options?: { prefetch?: number; batchSize?: number; batchTimeout?: number },
): WorkerInferUnsafeConsumerHandlerEntry<TContract, TName> {
  validateConsumerExists(contract, String(consumerName));

  if (options) {
    return [handler, options] as WorkerInferUnsafeConsumerHandlerEntry<TContract, TName>;
  }
  return handler as WorkerInferUnsafeConsumerHandlerEntry<TContract, TName>;
}

/**
 * Define multiple unsafe handlers for consumers in a contract.
 *
 * @deprecated Use `defineHandlers` instead for explicit error handling with Future<Result>.
 *
 * **Warning:** Unsafe handlers use exception-based error handling.
 * Consider migrating to safe handlers for better error control.
 *
 * @template TContract - The contract definition type
 * @param contract - The contract definition containing the consumers
 * @param handlers - An object with async handler functions for each consumer
 * @returns A type-safe handlers object that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineUnsafeHandlers } from '@amqp-contract/worker';
 *
 * // ⚠️ Consider using defineHandlers for better error handling
 * const handlers = defineUnsafeHandlers(orderContract, {
 *   processOrder: async (message) => {
 *     await processPayment(message);
 *   },
 *   notifyOrder: async (message) => {
 *     await sendNotification(message);
 *   },
 * });
 * ```
 */
export function defineUnsafeHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: WorkerInferUnsafeConsumerHandlers<TContract>,
): WorkerInferUnsafeConsumerHandlers<TContract> {
  validateHandlers(contract, handlers as unknown as Record<string, unknown>);
  return handlers;
}
