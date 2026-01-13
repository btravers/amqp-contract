import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
  MessageDefinition,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Future, Result } from "@swan-io/boxed";
import type { ConsumeMessage } from "amqplib";
import type { HandlerError } from "./errors.js";

/**
 * TTL-Backoff retry options for exponential backoff with configurable delays.
 *
 * Uses TTL + wait queue pattern. Messages are published to a wait queue with
 * per-message TTL, then dead-lettered back to the main queue after the TTL expires.
 *
 * **Benefits:** Configurable delays with exponential backoff and jitter.
 * **Limitation:** More complex, potential head-of-queue blocking with mixed TTLs.
 */
export type TtlBackoffRetryOptions = {
  /**
   * TTL-Backoff mode uses wait queues with per-message TTL for exponential backoff.
   * This is the default mode.
   */
  mode?: "ttl-backoff";
  /**
   * Maximum retry attempts before sending to DLQ.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Initial delay in ms before first retry.
   * @default 1000
   */
  initialDelayMs?: number;
  /**
   * Maximum delay in ms between retries.
   * @default 30000
   */
  maxDelayMs?: number;
  /**
   * Exponential backoff multiplier.
   * @default 2
   */
  backoffMultiplier?: number;
  /**
   * Add jitter to prevent thundering herd.
   * @default true
   */
  jitter?: boolean;
};

/**
 * Quorum-Native retry options using RabbitMQ's native delivery limit feature.
 *
 * Uses quorum queue's `x-delivery-limit` feature. Messages are requeued immediately
 * with `nack(requeue=true)`, and RabbitMQ tracks delivery count via `x-delivery-count`
 * header. When the count exceeds the queue's `deliveryLimit`, the message is
 * automatically dead-lettered.
 *
 * **Benefits:** Simpler architecture, no wait queues needed, no head-of-queue blocking.
 * **Limitation:** Immediate retries only (no exponential backoff).
 *
 * @see https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling
 */
export type QuorumNativeRetryOptions = {
  /**
   * Quorum-Native mode uses RabbitMQ's native delivery limit feature.
   * Requires the queue to be a quorum queue with `deliveryLimit` configured.
   */
  mode: "quorum-native";
};

/**
 * Retry configuration options for handling failed message processing.
 *
 * This is a discriminated union type based on the `mode` field:
 * - `"ttl-backoff"` (default): Supports all backoff options (maxRetries, delays, jitter)
 * - `"quorum-native"`: No additional options (uses queue's deliveryLimit)
 *
 * @example
 * // TTL-Backoff mode with custom options
 * const ttlRetry: RetryOptions = {
 *   mode: "ttl-backoff",
 *   maxRetries: 5,
 *   initialDelayMs: 2000,
 * };
 *
 * @example
 * // Quorum-Native mode (uses queue's deliveryLimit)
 * const quorumRetry: RetryOptions = {
 *   mode: "quorum-native",
 * };
 */
export type RetryOptions = TtlBackoffRetryOptions | QuorumNativeRetryOptions;

/**
 * Retry mode determines how failed messages are retried.
 *
 * - `"quorum-native"`: Uses quorum queue's native `x-delivery-limit` feature.
 * - `"ttl-backoff"`: Uses TTL + wait queue pattern for exponential backoff.
 */
export type RetryMode = "quorum-native" | "ttl-backoff";

/**
 * Infer the TypeScript type from a schema
 */
type InferSchemaInput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<infer TInput> ? TInput : never;

/**
 * Infer consumer message payload input type
 */
type ConsumerInferPayloadInput<TConsumer extends ConsumerDefinition> = InferSchemaInput<
  TConsumer["message"]["payload"]
>;

/**
 * Infer consumer message headers input type
 * Returns undefined if no headers schema is defined
 */
type ConsumerInferHeadersInput<TConsumer extends ConsumerDefinition> =
  TConsumer["message"] extends MessageDefinition<infer _TPayload, infer THeaders>
    ? THeaders extends StandardSchemaV1<Record<string, unknown>>
      ? InferSchemaInput<THeaders>
      : undefined
    : undefined;

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
 * Worker perspective types - for consuming messages (payload only)
 * @deprecated Use WorkerConsumedMessage for the full message including headers
 */
export type WorkerInferConsumerInput<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerInferPayloadInput<InferConsumer<TContract, TName>>;

/**
 * Infer the headers type for a specific consumer
 * Returns undefined if no headers schema is defined
 */
export type WorkerInferConsumerHeaders<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerInferHeadersInput<InferConsumer<TContract, TName>>;

/**
 * A consumed message containing parsed payload and headers.
 *
 * This type represents the first argument passed to consumer handlers.
 * It contains the validated payload and (if defined in the message schema) the validated headers.
 *
 * @template TPayload - The inferred payload type from the message schema
 * @template THeaders - The inferred headers type from the message schema (undefined if not defined)
 *
 * @example
 * ```typescript
 * // Handler receives the consumed message with typed payload and headers
 * const handler = defineHandler(contract, 'processOrder', (message, rawMessage) => {
 *   console.log(message.payload.orderId);  // Typed payload
 *   console.log(message.headers?.priority); // Typed headers (if defined)
 *   console.log(rawMessage.fields.deliveryTag); // Raw AMQP message
 *   return Future.value(Result.Ok(undefined));
 * });
 * ```
 */
export type WorkerConsumedMessage<TPayload, THeaders = undefined> = THeaders extends undefined
  ? {
      /** The validated message payload */
      payload: TPayload;
    }
  : {
      /** The validated message payload */
      payload: TPayload;
      /** The validated message headers */
      headers: THeaders;
    };

/**
 * Infer the full consumed message type for a specific consumer.
 * Includes both payload and headers (if defined).
 */
export type WorkerInferConsumedMessage<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = WorkerConsumedMessage<
  WorkerInferConsumerInput<TContract, TName>,
  WorkerInferConsumerHeaders<TContract, TName>
>;

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
 * @param message - The parsed message containing validated payload and headers
 * @param rawMessage - The raw AMQP message with all metadata (fields, properties, content)
 *
 * @example
 * ```typescript
 * const handler: WorkerInferSafeConsumerHandler<typeof contract, 'processOrder'> =
 *   (message, rawMessage) => {
 *     console.log(message.payload.orderId);  // Typed payload
 *     console.log(rawMessage.fields.deliveryTag); // Raw AMQP message
 *     return Future.value(Result.Ok(undefined));
 *   };
 * ```
 */
export type WorkerInferSafeConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (
  message: WorkerInferConsumedMessage<TContract, TName>,
  rawMessage: ConsumeMessage,
) => Future<Result<void, HandlerError>>;

/**
 * Safe consumer handler type for batch processing.
 * Returns a `Future<Result<void, HandlerError>>` for explicit error handling.
 *
 * @param messages - Array of parsed messages with validated payload and headers
 * @param rawMessages - Array of raw AMQP messages (same order as messages)
 *
 * @example
 * ```typescript
 * const handler: WorkerInferSafeConsumerBatchHandler<typeof contract, 'processOrders'> =
 *   (messages, rawMessages) => {
 *     messages.forEach((msg, i) => {
 *       console.log(msg.payload.orderId);
 *       console.log(rawMessages[i].fields.deliveryTag);
 *     });
 *     return Future.value(Result.Ok(undefined));
 *   };
 * ```
 */
export type WorkerInferSafeConsumerBatchHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (
  messages: Array<WorkerInferConsumedMessage<TContract, TName>>,
  rawMessages: ConsumeMessage[],
) => Future<Result<void, HandlerError>>;

/**
 * Safe handler entry for a consumer - either a function or a tuple of [handler, options].
 *
 * Three patterns are supported:
 * 1. Simple handler: `(message, rawMessage) => Future.value(Result.Ok(undefined))`
 * 2. Handler with prefetch and/or retry: `[(message, rawMessage) => ..., { prefetch: 10, retry: { maxRetries: 3 } }]`
 * 3. Batch handler: `[(messages, rawMessages) => ..., { batchSize: 5, batchTimeout: 1000, retry: { mode: "ttl-backoff" } }]`
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
 * @param message - The parsed message containing validated payload and headers
 * @param rawMessage - The raw AMQP message with all metadata (fields, properties, content)
 *
 * **Note:** When using unsafe handlers:
 * - All thrown errors are treated as retryable by default (when retry is configured)
 * - Use RetryableError or NonRetryableError to control retry behavior explicitly
 */
export type WorkerInferUnsafeConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (
  message: WorkerInferConsumedMessage<TContract, TName>,
  rawMessage: ConsumeMessage,
) => Promise<void>;

/**
 * Unsafe consumer handler type for batch processing.
 * Returns a `Promise<void>` - throws exceptions on error.
 *
 * @deprecated Prefer using safe handlers (WorkerInferSafeConsumerBatchHandler) that return
 * `Future<Result<void, HandlerError>>` for better error handling.
 *
 * @param messages - Array of parsed messages with validated payload and headers
 * @param rawMessages - Array of raw AMQP messages (same order as messages)
 */
export type WorkerInferUnsafeConsumerBatchHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (
  messages: Array<WorkerInferConsumedMessage<TContract, TName>>,
  rawMessages: ConsumeMessage[],
) => Promise<void>;

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
