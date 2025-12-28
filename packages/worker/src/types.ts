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
 * Infer all consumer handlers for a contract.
 * Handlers can be either single-message or batch handlers.
 */
export type WorkerInferConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]:
    | WorkerInferConsumerHandler<TContract, K>
    | WorkerInferConsumerBatchHandler<TContract, K>;
};
