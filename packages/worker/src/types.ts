import type {
  ConsumerInferInput,
  ContractDefinition,
  InferConsumer,
  InferConsumerNames,
} from "@amqp-contract/contract";

/**
 * Worker perspective types - for consuming messages
 */
export type WorkerInferConsumerInput<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerInferInput<InferConsumer<TContract, TName>>;

/**
 * Infer consumer handler type for a specific consumer
 */
export type WorkerInferConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = (message: WorkerInferConsumerInput<TContract, TName>) => Promise<void> | void;

/**
 * Infer all consumer handlers for a contract
 */
export type WorkerInferConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferConsumerHandler<TContract, K>;
};
