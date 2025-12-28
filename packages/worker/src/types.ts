import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";

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
 * Consumer options for configuring message consumption behavior.
 */
export type ConsumerOptions = {
  /**
   * Maximum number of unacknowledged messages the consumer can have at once.
   * Controls the prefetch count for this consumer's channel.
   * If not set, uses the channel's default prefetch (typically unlimited).
   */
  prefetch?: number;

  /**
   * Number of messages to batch together before calling the handler.
   * When set, the handler will receive an array of messages instead of a single message.
   * Messages are accumulated until either the batch size is reached or the batch timeout expires.
   */
  batchSize?: number;

  /**
   * Maximum time in milliseconds to wait for a batch to fill before processing.
   * Only used when batchSize is set. If the timeout is reached before the batch is full,
   * the handler will be called with whatever messages have been accumulated.
   *
   * @default 1000 (1 second)
   */
  batchTimeout?: number;
};

/**
 * Infer handler entry for a consumer - either a function or a tuple of [handler, options].
 */
export type WorkerInferConsumerHandlerEntry<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  | WorkerInferConsumerHandler<TContract, TName>
  | WorkerInferConsumerBatchHandler<TContract, TName>
  | readonly [
      WorkerInferConsumerHandler<TContract, TName> | WorkerInferConsumerBatchHandler<TContract, TName>,
      ConsumerOptions,
    ];

/**
 * Infer all consumer handlers for a contract.
 * Handlers can be either single-message handlers, batch handlers, or a tuple of [handler, options].
 */
export type WorkerInferConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferConsumerHandlerEntry<TContract, K>;
};
