import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Retry policy for handling failed message processing.
 *
 * Inspired by Temporal.io's retry policies, this configuration allows you to:
 * - Limit the number of retry attempts to prevent infinite loops
 * - Configure exponential backoff to reduce load during outages
 * - Specify non-retryable errors that should immediately fail
 *
 * @example
 * ```typescript
 * const retryPolicy: RetryPolicy = {
 *   maxAttempts: 3,
 *   backoff: {
 *     type: 'exponential',
 *     initialInterval: 1000,
 *     maxInterval: 60000,
 *     coefficient: 2
 *   },
 *   nonRetryableErrors: ['ValidationError', 'AuthenticationError']
 * };
 * ```
 */
export type RetryPolicy = {
  /**
   * Maximum number of attempts (initial attempt + retries).
   * After this limit is reached, the message will be:
   * - Sent to the dead letter exchange if configured on the queue
   * - Rejected (nacked without requeue) if no dead letter exchange
   *
   * Set to 1 to process once with no retries on failure (fail fast).
   * Set to 0 to process once with no retries (effectively same as 1).
   * If not specified, defaults to 1 (no retries).
   */
  maxAttempts?: number;

  /**
   * Backoff strategy for retry intervals.
   * Adds delay between retry attempts to avoid overwhelming the system.
   */
  backoff?: {
    /**
     * Type of backoff strategy.
     * - `fixed`: Same interval for every retry
     * - `exponential`: Interval increases exponentially with each retry
     *
     * If not specified, defaults to 'fixed'.
     */
    type?: "fixed" | "exponential";

    /**
     * Initial interval in milliseconds before the first retry.
     * For exponential backoff, this is the base interval.
     *
     * If not specified, defaults to 1000ms (1 second).
     */
    initialInterval?: number;

    /**
     * Maximum interval in milliseconds between retries.
     * Prevents exponential backoff from growing indefinitely.
     *
     * Only applies to exponential backoff.
     * If not specified, defaults to 60000ms (60 seconds).
     */
    maxInterval?: number;

    /**
     * Multiplication coefficient for exponential backoff.
     * Each retry interval is multiplied by this value.
     *
     * Formula: interval = initialInterval * (coefficient ^ attemptNumber)
     * Capped at maxInterval to prevent unbounded growth.
     *
     * Only applies to exponential backoff.
     * If not specified, defaults to 2.
     */
    coefficient?: number;
  };

  /**
   * List of error patterns that should not trigger retries.
   *
   * Errors matching these patterns will cause the message to be immediately
   * rejected (sent to DLX if configured, otherwise discarded).
   *
   * Matching is done by:
   * - Error constructor name (e.g., 'ValidationError')
   * - Error message substring (e.g., 'invalid format')
   *
   * Inspired by Temporal.io's NonRetryableErrorTypes.
   *
   * @example
   * ```typescript
   * nonRetryableErrors: ['ValidationError', 'AuthenticationError', 'invalid format']
   * ```
   */
  nonRetryableErrors?: readonly string[];
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

/**
 * Infer consumer handler type for a specific consumer.
 * Handlers always receive a single message by default.
 * For batch processing, use consumerOptions to configure batch behavior.
 */
export type WorkerInferConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (message: WorkerInferConsumerInput<TContract, TName>) => Promise<void>;

/**
 * Infer consumer handler type for batch processing.
 * Batch handlers receive an array of messages.
 */
export type WorkerInferConsumerBatchHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (messages: Array<WorkerInferConsumerInput<TContract, TName>>) => Promise<void>;

/**
 * Infer handler entry for a consumer - either a function or a tuple of [handler, options].
 *
 * Four patterns are supported:
 * 1. Simple handler: `async (message) => { ... }`
 * 2. Handler with options: `[async (message) => { ... }, { prefetch: 10, retryPolicy: {...} }]`
 * 3. Batch handler: `[async (messages) => { ... }, { batchSize: 5, batchTimeout: 1000, retryPolicy: {...} }]`
 */
export type WorkerInferConsumerHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  | WorkerInferConsumerHandler<TContract, TName>
  | readonly [
      WorkerInferConsumerHandler<TContract, TName>,
      { prefetch?: number; batchSize?: never; batchTimeout?: never; retryPolicy?: RetryPolicy },
    ]
  | readonly [
      WorkerInferConsumerBatchHandler<TContract, TName>,
      { prefetch?: number; batchSize: number; batchTimeout?: number; retryPolicy?: RetryPolicy },
    ];

/**
 * Infer all consumer handlers for a contract.
 * Handlers can be either single-message handlers, batch handlers, or a tuple of [handler, options].
 */
export type WorkerInferConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferConsumerHandlerEntry<TContract, K>;
};
