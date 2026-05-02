import type {
  ContractDefinition,
  InferPublisherNames,
  MessageDefinition,
  PublisherEntry,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Infer the TypeScript type from a schema (input side, used for publish payloads).
 */
type InferSchemaInput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<infer TInput> ? TInput : never;

/**
 * Infer the TypeScript type from a schema (output side, used for validated responses).
 */
type InferSchemaOutput<TSchema extends StandardSchemaV1> =
  TSchema extends StandardSchemaV1<infer _TInput, infer TOutput> ? TOutput : never;

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
 * Infer publisher response output type. Returns the response payload type when
 * the publisher is an RPC client (has required `responseMessage` after the
 * `defineRpcClient` intersection), otherwise `never`.
 */
type PublisherInferResponseOutput<TPublisher extends PublisherEntry> = TPublisher extends {
  responseMessage: infer TResponse;
}
  ? TResponse extends MessageDefinition
    ? TResponse extends { payload: StandardSchemaV1 }
      ? InferSchemaOutput<TResponse["payload"]>
      : never
    : never
  : never;

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

/**
 * Names of publishers that are RPC clients (their definition carries a required
 * `responseMessage` after the `defineRpcClient` intersection). These are the
 * only valid arguments to `client.call(...)`.
 */
export type ClientInferRpcPublisherNames<TContract extends ContractDefinition> = {
  [K in InferPublisherNames<TContract>]: InferPublisher<TContract, K> extends {
    responseMessage: infer TResponse;
  }
    ? TResponse extends MessageDefinition
      ? K
      : never
    : never;
}[InferPublisherNames<TContract>];

/**
 * Infer the response payload output type for an RPC publisher.
 */
export type ClientInferRpcResponseOutput<
  TContract extends ContractDefinition,
  TName extends ClientInferRpcPublisherNames<TContract>,
> = PublisherInferResponseOutput<InferPublisher<TContract, TName>>;
