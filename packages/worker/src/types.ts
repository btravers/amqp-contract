import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
  MessageDefinition,
} from "@amqp-contract/contract";
import type { Future, Result } from "@swan-io/boxed";
import type { ConsumeMessage } from "amqplib";
import type { HandlerError } from "./errors.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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
 * Infer the payload type for a specific consumer
 */
type WorkerInferConsumerPayload<
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
export type WorkerConsumedMessage<TPayload, THeaders = undefined> = {
  /** The validated message payload */
  payload: TPayload;
  /** The validated message headers (present only when headers schema is defined) */
  headers: THeaders extends undefined ? undefined : THeaders;
};

/**
 * Infer the full consumed message type for a specific consumer.
 * Includes both payload and headers (if defined).
 */
export type WorkerInferConsumedMessage<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = WorkerConsumedMessage<
  WorkerInferConsumerPayload<TContract, TName>,
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
 *   ({ payload }, rawMessage) => {
 *     console.log(payload.orderId);  // Typed payload
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
 * Safe handler entry for a consumer - either a function or a tuple of [handler, options].
 *
 * Two patterns are supported:
 * 1. Simple handler: `({ payload }, rawMessage) => Future.value(Result.Ok(undefined))`
 * 2. Handler with prefetch: `[({ payload }, rawMessage) => ..., { prefetch: 10 }]`
 *
 * Note: Retry configuration is now defined at the queue level in the contract,
 * not at the handler level. See `QueueDefinition.retry` for configuration options.
 */
export type WorkerInferSafeConsumerHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  | WorkerInferSafeConsumerHandler<TContract, TName>
  | readonly [WorkerInferSafeConsumerHandler<TContract, TName>, { prefetch?: number }];

/**
 * Safe consumer handlers for a contract.
 * All handlers return `Future<Result<void, HandlerError>>` for explicit error control.
 */
export type WorkerInferSafeConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferSafeConsumerHandlerEntry<TContract, K>;
};
