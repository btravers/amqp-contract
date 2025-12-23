import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ContractDefinition,
  InferPublisherNames,
  PublisherDefinition,
} from "@amqp-contract/contract";

/**
 * Infer the TypeScript type from a schema
 */
type InferSchemaInput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<infer TInput> ? TInput : never;

/**
 * Infer publisher message input type
 */
type PublisherInferInput<TPublisher extends PublisherDefinition> = InferSchemaInput<
  TPublisher["message"]["payload"]
>;

/**
 * Infer all publishers from contract
 */
type InferPublishers<TContract extends ContractDefinition> = NonNullable<TContract["publishers"]>;

/**
 * Get specific publisher definition from contract
 */
type InferPublisher<
  TContract extends ContractDefinition,
  TName extends InferPublisherNames<TContract>,
> = InferPublishers<TContract>[TName];

/**
 * Infer publisher input type (message payload) for a specific publisher in a contract
 */
export type ClientInferPublisherInput<
  TContract extends ContractDefinition,
  TName extends InferPublisherNames<TContract>,
> = PublisherInferInput<InferPublisher<TContract, TName>>;
