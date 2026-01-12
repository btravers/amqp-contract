import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import type { Future, Result } from "@swan-io/boxed";
import type { HandlerError } from "./errors.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Retry mode determines how failed messages are retried.
 *
 * - `"quorum-native"`: Uses quorum queue's native `x-delivery-limit` feature.
 *   Messages are requeued immediately with `nack(requeue=true)`, and RabbitMQ
 *   tracks delivery count via `x-delivery-count` header. When the count exceeds
 *   the queue's `deliveryLimit`, the message is automatically dead-lettered.
 *   **Benefits:** Simpler architecture, no wait queues needed, no head-of-queue blocking.
 *   **Limitation:** Immediate retries only (no exponential backoff).
 *
 * - `"ttl-backoff"`: Uses TTL + wait queue pattern for exponential backoff.
 *   Messages are published to a wait queue with per-message TTL, then dead-lettered
 *   back to the main queue after the TTL expires.
 *   **Benefits:** Configurable delays with exponential backoff and jitter.
 *   **Limitation:** More complex, potential head-of-queue blocking with mixed TTLs.
 *
 * @see https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling
 */
export type RetryMode = "quorum-native" | "ttl-backoff";

/**
 * Retry configuration options for handling failed message processing.
 *
 * When enabled, the worker will automatically retry failed messages using
 * either RabbitMQ's native quorum queue delivery limit or the TTL + DLX pattern.
 */
export type RetryOptions = {
  /**
   * Retry mode determines the retry strategy.
   *
   * - `"quorum-native"`: Leverages quorum queue's `x-delivery-limit` feature.
   *   Requires the queue to be a quorum queue with `deliveryLimit` configured.
   *   Messages are requeued immediately (no exponential backoff).
   *
   * - `"ttl-backoff"`: Uses TTL + wait queue pattern for exponential backoff.
   *   Requires queues to have DLX configured. Supports configurable delays.
   *
   * @default "ttl-backoff" for backward compatibility
   */
  mode?: RetryMode;
  /**
   * Maximum retry attempts before sending to DLQ.
   * Only used when mode is "ttl-backoff". For "quorum-native" mode, use
   * the queue's `deliveryLimit` option instead.
   * @default 3
   */
  maxRetries?: number;
  /** Initial delay in ms before first retry (only for "ttl-backoff" mode, default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (only for "ttl-backoff" mode, default: 30000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (only for "ttl-backoff" mode, default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to prevent thundering herd (only for "ttl-backoff" mode, default: true) */
  jitter?: boolean;
};

/**
 * Infer the TypeScript type from a schema
 */
type InferSchemaInput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<infer TInput> ? TInput : never;

/**
 * Infer consumer message input type
 */
type ConsumerInferInput<TConsumer extends ConsumerDefinition> = InferSchemaInput<
  TConsumer["message"]["payload"]
>;

/**
 * Infer all consumers from contract
 */
type InferConsumers<TContract extends ContractDefinition> = NonNullable<TContract["consumers"]>;

/**
 * Get specific consumer definition from contract
 */
type InferConsumer<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = InferConsumers<TContract>[TName];

/**
 * Worker perspective types - for consuming messages
 */
export type WorkerInferConsumerInput<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerInferInput<InferConsumer<TContract, TName>>;

// =============================================================================
// Safe Handler Types (Recommended)
// =============================================================================
// These handlers return `Future<Result<void, HandlerError>>` for explicit error handling.
// This approach forces the handler to explicitly handle success/failure cases,
// making the code more robust and easier to reason about.

/**
 * Safe consumer handler type for a specific consumer.
 * Returns a `Future<Result<void, HandlerError>>` for explicit error handling.
 *
 * **Recommended over unsafe handlers** for better error control:
 * - RetryableError: Message will be retried with exponential backoff
 * - NonRetryableError: Message will be immediately sent to DLQ
 *
 * @example
 * ```typescript
 * const handler: WorkerInferSafeConsumerHandler<typeof contract, 'processOrder'> =
 *   (message) => Future.value(Result.Ok(undefined));
 * ```
 */
export type WorkerInferSafeConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (message: WorkerInferConsumerInput<TContract, TName>) => Future<Result<void, HandlerError>>;

/**
 * Safe consumer handler type for batch processing.
 * Returns a `Future<Result<void, HandlerError>>` for explicit error handling.
 *
 * @example
 * ```typescript
 * const handler: WorkerInferSafeConsumerBatchHandler<typeof contract, 'processOrders'> =
 *   (messages) => Future.value(Result.Ok(undefined));
 * ```
 */
export type WorkerInferSafeConsumerBatchHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (
  messages: Array<WorkerInferConsumerInput<TContract, TName>>,
) => Future<Result<void, HandlerError>>;

/**
 * Safe handler entry for a consumer - either a function or a tuple of [handler, options].
 *
 * Three patterns are supported:
 * 1. Simple handler: `(message) => Future.value(Result.Ok(undefined))`
 * 2. Handler with prefetch and/or retry: `[(message) => ..., { prefetch: 10, retry: { maxRetries: 3 } }]`
 * 3. Batch handler: `[(messages) => ..., { batchSize: 5, batchTimeout: 1000, retry: { mode: "ttl-backoff" } }]`
 */
export type WorkerInferSafeConsumerHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  | WorkerInferSafeConsumerHandler<TContract, TName>
  | readonly [
      WorkerInferSafeConsumerHandler<TContract, TName>,
      { prefetch?: number; batchSize?: never; batchTimeout?: never; retry?: RetryOptions },
    ]
  | readonly [
      WorkerInferSafeConsumerBatchHandler<TContract, TName>,
      { prefetch?: number; batchSize: number; batchTimeout?: number; retry?: RetryOptions },
    ];

/**
 * Safe consumer handlers for a contract.
 * All handlers return `Future<Result<void, HandlerError>>` for explicit error control.
 */
export type WorkerInferSafeConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferSafeConsumerHandlerEntry<TContract, K>;
};

// =============================================================================
// Unsafe Handler Types (Legacy)
// =============================================================================
// These handlers return Promise<void> and use exceptions for error handling.
// They are considered "unsafe" because errors can be missed or mishandled.
// Use safe handlers for new code.

/**
 * Unsafe consumer handler type for a specific consumer.
 * Returns a `Promise<void>` - throws exceptions on error.
 *
 * @deprecated Prefer using safe handlers (WorkerInferSafeConsumerHandler) that return
 * `Future<Result<void, HandlerError>>` for better error handling.
 *
 * **Note:** When using unsafe handlers:
 * - All thrown errors are treated as retryable by default (when retry is configured)
 * - Use RetryableError or NonRetryableError to control retry behavior explicitly
 */
export type WorkerInferUnsafeConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (message: WorkerInferConsumerInput<TContract, TName>) => Promise<void>;

/**
 * Unsafe consumer handler type for batch processing.
 * Returns a `Promise<void>` - throws exceptions on error.
 *
 * @deprecated Prefer using safe handlers (WorkerInferSafeConsumerBatchHandler) that return
 * `Future<Result<void, HandlerError>>` for better error handling.
 */
export type WorkerInferUnsafeConsumerBatchHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (messages: Array<WorkerInferConsumerInput<TContract, TName>>) => Promise<void>;

/**
 * Unsafe handler entry for a consumer - either a function or a tuple of [handler, options].
 *
 * @deprecated Prefer using safe handler entries (WorkerInferSafeConsumerHandlerEntry).
 */
export type WorkerInferUnsafeConsumerHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  | WorkerInferUnsafeConsumerHandler<TContract, TName>
  | readonly [
      WorkerInferUnsafeConsumerHandler<TContract, TName>,
      { prefetch?: number; batchSize?: never; batchTimeout?: never; retry?: RetryOptions },
    ]
  | readonly [
      WorkerInferUnsafeConsumerBatchHandler<TContract, TName>,
      { prefetch?: number; batchSize: number; batchTimeout?: number; retry?: RetryOptions },
    ];

/**
 * Unsafe consumer handlers for a contract.
 *
 * @deprecated Prefer using safe handlers (WorkerInferSafeConsumerHandlers).
 */
export type WorkerInferUnsafeConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferUnsafeConsumerHandlerEntry<TContract, K>;
};

// =============================================================================
// Legacy Type Aliases (for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use WorkerInferUnsafeConsumerHandler instead
 */
export type WorkerInferConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = WorkerInferUnsafeConsumerHandler<TContract, TName>;

/**
 * @deprecated Use WorkerInferUnsafeConsumerBatchHandler instead
 */
export type WorkerInferConsumerBatchHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = WorkerInferUnsafeConsumerBatchHandler<TContract, TName>;

/**
 * @deprecated Use WorkerInferUnsafeConsumerHandlerEntry instead
 */
export type WorkerInferConsumerHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = WorkerInferUnsafeConsumerHandlerEntry<TContract, TName>;

/**
 * @deprecated Use WorkerInferUnsafeConsumerHandlers instead
 */
export type WorkerInferConsumerHandlers<TContract extends ContractDefinition> =
  WorkerInferUnsafeConsumerHandlers<TContract>;
