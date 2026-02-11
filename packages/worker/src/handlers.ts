import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import type {
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlerEntry,
  WorkerInferConsumerHandlers,
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
  handlers: object,
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
// Handler Definitions
// =============================================================================

/**
 * Define a type-safe handler for a specific consumer in a contract.
 *
 * **Recommended:** This function creates handlers that return `Future<Result<void, HandlerError>>`,
 * providing explicit error handling and better control over retry behavior.
 *
 * Supports two patterns:
 * 1. Simple handler: just the function
 * 2. Handler with options: [handler, { prefetch: 10 }]
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The handler function that returns `Future<Result<void, HandlerError>>`
 * @param options - Optional consumer options (prefetch)
 * @returns A type-safe handler that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineHandler, RetryableError, NonRetryableError } from '@amqp-contract/worker';
 * import { Future, Result } from '@swan-io/boxed';
 * import { orderContract } from './contract';
 *
 * // Simple handler with explicit error handling using mapError
 * const processOrderHandler = defineHandler(
 *   orderContract,
 *   'processOrder',
 *   ({ payload }) =>
 *     Future.fromPromise(processPayment(payload))
 *       .mapOk(() => undefined)
 *       .mapError((error) => new RetryableError('Payment failed', error))
 * );
 *
 * // Handler with validation (non-retryable error)
 * const validateOrderHandler = defineHandler(
 *   orderContract,
 *   'validateOrder',
 *   ({ payload }) => {
 *     if (payload.amount < 1) {
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
  handler: WorkerInferConsumerHandler<TContract, TName>,
): WorkerInferConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerHandler<TContract, TName>,
  options: { prefetch?: number },
): WorkerInferConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerHandler<TContract, TName>,
  options?: { prefetch?: number },
): WorkerInferConsumerHandlerEntry<TContract, TName> {
  validateConsumerExists(contract, String(consumerName));

  if (options) {
    return [handler, options];
  }
  return handler;
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
 * import { defineHandlers, RetryableError } from '@amqp-contract/worker';
 * import { Future } from '@swan-io/boxed';
 * import { orderContract } from './contract';
 *
 * const handlers = defineHandlers(orderContract, {
 *   processOrder: ({ payload }) =>
 *     Future.fromPromise(processPayment(payload))
 *       .mapOk(() => undefined)
 *       .mapError((error) => new RetryableError('Payment failed', error)),
 *   notifyOrder: ({ payload }) =>
 *     Future.fromPromise(sendNotification(payload))
 *       .mapOk(() => undefined)
 *       .mapError((error) => new RetryableError('Notification failed', error)),
 * });
 * ```
 */
export function defineHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: WorkerInferConsumerHandlers<TContract>,
): WorkerInferConsumerHandlers<TContract> {
  validateHandlers(contract, handlers);
  return handlers;
}
