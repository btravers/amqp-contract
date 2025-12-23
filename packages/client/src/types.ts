import type {
  ContractDefinition,
  InferPublisher,
  InferPublisherNames,
  PublisherInferInput,
} from "@amqp-contract/contract";

/**
 * Infer publisher input type (message payload) for a specific publisher in a contract
 */
export type ClientInferPublisherInput<
  TContract extends ContractDefinition,
  TName extends InferPublisherNames<TContract>,
> = PublisherInferInput<InferPublisher<TContract, TName>>;
