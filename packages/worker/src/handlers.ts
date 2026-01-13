import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import {
  ContractValidationError,
  assertConsumerExists,
  assertHandlersMatchConsumers,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { NonRetryableError, RetryableError, TechnicalError } from "./errors.js";
import type {
  RetryOptions,
  WorkerConsumedMessage,
  WorkerInferConsumedMessage,
  WorkerInferSafeConsumerHandler,
  WorkerInferSafeConsumerHandlerEntry,
  WorkerInferSafeConsumerHandlers,
} from "./types.js";
import type { ConsumeMessage } from "amqplib";
import type { HandlerError } from "./errors.js";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate that a consumer exists in the contract.
 * @throws {TechnicalError} if the consumer is not found in the contract
 */
function validateConsumerExists<TContract extends ContractDefinition>(
  contract: TContract,
  consumerName: string,
): void {
  try {
    assertConsumerExists(contract, consumerName);
  } catch (error) {
    if (error instanceof ContractValidationError) {
      throw new TechnicalError(error.message);
    }
    throw error;
  }
}

/**
 * Validate that all handlers reference valid consumers.
 * @throws {TechnicalError} if any handler references a non-existent consumer
 */
function validateHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: Record<string, unknown>,
): void {
  try {
    assertHandlersMatchConsumers(contract, Object.keys(handlers));
  } catch (error) {
    if (error instanceof ContractValidationError) {
      throw new TechnicalError(error.message);
    }
    throw error;
  }
}

/**
 * Wrap a Promise-based handler into a Future-based safe handler.
 * This is used internally by defineUnsafeHandler to convert Promise handlers to Future handlers.
 */
function wrapUnsafeHandler<TInput extends WorkerConsumedMessage<unknown, unknown>>(
  handler: (input: TInput, raw: ConsumeMessage) => Promise<void>,
): (input: TInput, raw: ConsumeMessage) => Future<Result<void, HandlerError>> {
  return (input: TInput, raw: ConsumeMessage): Future<Result<void, HandlerError>> => {
    return Future.fromPromise(handler(input, raw))
      .mapOkToResult(() => Result.Ok<void, HandlerError>(undefined))
      .flatMapError((error) => {
        // Check if error is already a HandlerError type
        if (error instanceof NonRetryableError || error instanceof RetryableError) {
          return Future.value(Result.Error<void, HandlerError>(error));
        }
        // Wrap other errors as RetryableError
        const retryableError = new RetryableError(
          error instanceof Error ? error.message : String(error),
          error,
        );
        return Future.value(Result.Error<void, HandlerError>(retryableError));
      });
  };
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
 * Supports two patterns:
 * 1. Simple handler: just the function
 * 2. Handler with options: [handler, { prefetch: 10, retry: {...} }]
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The handler function that returns `Future<Result<void, HandlerError>>`
 * @param options - Optional consumer options (prefetch, retry)
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
  handler: WorkerInferSafeConsumerHandler<TContract, TName>,
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferSafeConsumerHandler<TContract, TName>,
  options: { prefetch?: number; retry?: RetryOptions },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferSafeConsumerHandler<TContract, TName>,
  options?: { prefetch?: number; retry?: RetryOptions },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName> {
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
  handlers: WorkerInferSafeConsumerHandlers<TContract>,
): WorkerInferSafeConsumerHandlers<TContract> {
  validateHandlers(contract, handlers as unknown as Record<string, unknown>);
  return handlers;
}

// =============================================================================
// Unsafe Handler Definitions
// =============================================================================

/**
 * Unsafe handler type for single messages (internal use).
 */
type UnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (
  message: WorkerInferConsumedMessage<TContract, TName>,
  rawMessage: ConsumeMessage,
) => Promise<void>;

/**
 * Define an unsafe handler for a specific consumer in a contract.
 *
 * Prefer using `defineHandler` for explicit error handling with `Future<Result>`.
 *
 * **Note:** Unsafe handlers use exception-based error handling:
 * - All thrown errors are treated as retryable by default
 * - Harder to reason about which errors should be retried
 * - May lead to unexpected retry behavior
 *
 * **Note:** Internally, this function wraps the Promise-based handler into a Future-based
 * safe handler for consistent processing in the worker.
 *
 * @template TContract - The contract definition type
 * @template TName - The consumer name from the contract
 * @param contract - The contract definition containing the consumer
 * @param consumerName - The name of the consumer from the contract
 * @param handler - The async handler function that processes messages
 * @param options - Optional consumer options (prefetch, retry)
 * @returns A type-safe handler that can be used with TypedAmqpWorker
 *
 * @example
 * ```typescript
 * import { defineUnsafeHandler } from '@amqp-contract/worker';
 *
 * // Consider using defineHandler for better error handling
 * const processOrderHandler = defineUnsafeHandler(
 *   orderContract,
 *   'processOrder',
 *   async ({ payload }) => {
 *     // Throws on error - will be retried
 *     await processPayment(payload);
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
  handler: UnsafeHandler<TContract, TName>,
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineUnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: UnsafeHandler<TContract, TName>,
  options: { prefetch?: number; retry?: RetryOptions },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName>;
export function defineUnsafeHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
>(
  contract: TContract,
  consumerName: TName,
  handler: UnsafeHandler<TContract, TName>,
  options?: { prefetch?: number; retry?: RetryOptions },
): WorkerInferSafeConsumerHandlerEntry<TContract, TName> {
  validateConsumerExists(contract, String(consumerName));

  // Wrap the Promise-based handler into a Future-based handler
  const wrappedHandler = wrapUnsafeHandler(handler);

  if (options) {
    return [wrappedHandler, options];
  }
  return wrappedHandler;
}

/**
 * Unsafe handler entry type for internal use.
 */
type UnsafeHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  | UnsafeHandler<TContract, TName>
  | readonly [UnsafeHandler<TContract, TName>, { prefetch?: number; retry?: RetryOptions }];

/**
 * Unsafe handlers object type for internal use.
 */
type UnsafeHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: UnsafeHandlerEntry<TContract, K>;
};

/**
 * Define multiple unsafe handlers for consumers in a contract.
 *
 * Prefer using `defineHandlers` for explicit error handling with `Future<Result>`.
 *
 * **Note:** Unsafe handlers use exception-based error handling.
 * Consider migrating to safe handlers for better error control.
 *
 * **Note:** Internally, this function wraps all Promise-based handlers into Future-based
 * safe handlers for consistent processing in the worker.
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
 * // Consider using defineHandlers for better error handling
 * const handlers = defineUnsafeHandlers(orderContract, {
 *   processOrder: async ({ payload }) => {
 *     await processPayment(payload);
 *   },
 *   notifyOrder: async ({ payload }) => {
 *     await sendNotification(payload);
 *   },
 * });
 * ```
 */
export function defineUnsafeHandlers<TContract extends ContractDefinition>(
  contract: TContract,
  handlers: UnsafeHandlers<TContract>,
): WorkerInferSafeConsumerHandlers<TContract> {
  validateHandlers(contract, handlers as unknown as Record<string, unknown>);

  // Transform all handlers
  const result: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(handlers)) {
    if (Array.isArray(entry)) {
      // Tuple format: [handler, options]
      const [handler, options] = entry as [
        (input: WorkerConsumedMessage<unknown, unknown>, raw: ConsumeMessage) => Promise<void>,
        { prefetch?: number; retry?: RetryOptions },
      ];
      result[name] = [wrapUnsafeHandler(handler), options];
    } else {
      // Direct function format
      result[name] = wrapUnsafeHandler(
        entry as (
          input: WorkerConsumedMessage<unknown, unknown>,
          raw: ConsumeMessage,
        ) => Promise<void>,
      );
    }
  }

  return result as WorkerInferSafeConsumerHandlers<TContract>;
}
