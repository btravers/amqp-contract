import type {
  ContractDefinitionInput,
  InferPublisherNames,
  PublisherEntry,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Infer the TypeScript type from a schema
 */
type InferSchemaInput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<infer TInput> ? TInput : never;

/**
 * Infer publisher message input type.
 * Works with both PublisherDefinition and EventPublisherConfig since both have
 * a `message` property with a `payload` schema.
 */
type PublisherInferInput<TPublisher extends PublisherEntry> = TPublisher extends {
  message: { payload: StandardSchemaV1 };
}
  ? InferSchemaInput<TPublisher["message"]["payload"]>
  : never;

/**
 * Infer all publishers from contract
 */
type InferPublishers<TContract extends ContractDefinitionInput> = NonNullable<
  TContract["publishers"]
>;

/**
 * Get specific publisher definition from contract
 */
type InferPublisher<
  TContract extends ContractDefinitionInput,
  TName extends InferPublisherNames<TContract>,
> = InferPublishers<TContract>[TName];

/**
 * Infer publisher input type (message payload) for a specific publisher in a contract
 */
export type ClientInferPublisherInput<
  TContract extends ContractDefinitionInput,
  TName extends InferPublisherNames<TContract>,
> = PublisherInferInput<InferPublisher<TContract, TName>>;
