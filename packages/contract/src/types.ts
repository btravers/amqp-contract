import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Any schema that conforms to Standard Schema v1
 */
export type AnySchema = StandardSchemaV1;

/**
 * Exchange types supported by AMQP
 */
export type ExchangeType = "direct" | "fanout" | "topic" | "headers";

/**
 * Definition of an AMQP exchange
 */
export interface ExchangeDefinition {
  name: string;
  type: ExchangeType;
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  arguments?: Record<string, unknown>;
}

/**
 * Definition of an AMQP queue
 */
export interface QueueDefinition {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, unknown>;
}

/**
 * Binding between queue and exchange
 */
export interface QueueBindingDefinition {
  type: "queue";
  queue: string;
  exchange: string;
  routingKey?: string;
  arguments?: Record<string, unknown>;
}

/**
 * Binding between exchange and exchange
 */
export interface ExchangeBindingDefinition {
  type: "exchange";
  source: string;
  destination: string;
  routingKey?: string;
  arguments?: Record<string, unknown>;
}

/**
 * Binding definition - can be either queue-to-exchange or exchange-to-exchange
 */
export type BindingDefinition = QueueBindingDefinition | ExchangeBindingDefinition;

/**
 * Definition of a message publisher
 */
export interface PublisherDefinition<TMessageSchema extends AnySchema = AnySchema> {
  exchange: string;
  routingKey?: string;
  message: TMessageSchema;
}

/**
 * Definition of a message consumer
 */
export interface ConsumerDefinition<
  TMessageSchema extends AnySchema = AnySchema,
  THandlerResultSchema extends AnySchema = AnySchema,
> {
  queue: string;
  message: TMessageSchema;
  handlerResult?: THandlerResultSchema;
  prefetch?: number;
  noAck?: boolean;
}

/**
 * Contract definition containing all AMQP resources
 */
export interface ContractDefinition<
  TExchanges extends Record<string, ExchangeDefinition> = Record<string, ExchangeDefinition>,
  TQueues extends Record<string, QueueDefinition> = Record<string, QueueDefinition>,
  TBindings extends Record<string, BindingDefinition> = Record<string, BindingDefinition>,
  TPublishers extends Record<string, PublisherDefinition> = Record<string, PublisherDefinition>,
  TConsumers extends Record<string, ConsumerDefinition> = Record<string, ConsumerDefinition>,
> {
  exchanges?: TExchanges;
  queues?: TQueues;
  bindings?: TBindings;
  publishers?: TPublishers;
  consumers?: TConsumers;
}

/**
 * Infer the TypeScript type from a schema
 */
export type InferSchemaInput<TSchema extends AnySchema> =
  TSchema extends StandardSchemaV1<infer TInput> ? TInput : never;

/**
 * Infer the output type from a schema
 */
export type InferSchemaOutput<TSchema extends AnySchema> =
  TSchema extends StandardSchemaV1<unknown, infer TOutput> ? TOutput : never;

/**
 * Infer publisher message input type
 */
export type PublisherInferInput<TPublisher extends PublisherDefinition> = InferSchemaInput<
  TPublisher["message"]
>;

/**
 * Infer consumer message input type
 */
export type ConsumerInferInput<TConsumer extends ConsumerDefinition> = InferSchemaInput<
  TConsumer["message"]
>;

/**
 * Infer consumer handler result type
 */
export type ConsumerInferHandlerResult<TConsumer extends ConsumerDefinition> =
  TConsumer["handlerResult"] extends AnySchema
    ? InferSchemaOutput<TConsumer["handlerResult"]>
    : void;

/**
 * Consumer handler function type
 * Handlers return Promise for async handling
 * where HandlerResult is inferred from the consumer's handlerResult schema (defaults to void)
 */
export type ConsumerHandler<TConsumer extends ConsumerDefinition> = (
  message: ConsumerInferInput<TConsumer>,
) => Promise<ConsumerInferHandlerResult<TConsumer>>;

/**
 * Infer all publishers from contract
 */
export type InferPublishers<TContract extends ContractDefinition> = NonNullable<
  TContract["publishers"]
>;

/**
 * Infer all consumers from contract
 */
export type InferConsumers<TContract extends ContractDefinition> = NonNullable<
  TContract["consumers"]
>;

/**
 * Infer publisher names from contract
 */
export type InferPublisherNames<TContract extends ContractDefinition> =
  keyof InferPublishers<TContract>;

/**
 * Infer consumer names from contract
 */
export type InferConsumerNames<TContract extends ContractDefinition> =
  keyof InferConsumers<TContract>;

/**
 * Get specific publisher definition from contract
 */
export type InferPublisher<
  TContract extends ContractDefinition,
  TName extends InferPublisherNames<TContract>,
> = InferPublishers<TContract>[TName];

/**
 * Get specific consumer definition from contract
 */
export type InferConsumer<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = InferConsumers<TContract>[TName];

/**
 * Client perspective types - for publishing messages
 */
export type ClientInferPublisherInput<
  TContract extends ContractDefinition,
  TName extends InferPublisherNames<TContract>,
> = PublisherInferInput<InferPublisher<TContract, TName>>;

/**
 * Worker perspective types - for consuming messages
 */
export type WorkerInferConsumerInput<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerInferInput<InferConsumer<TContract, TName>>;

/**
 * Worker perspective - consumer handler result type
 */
export type WorkerInferConsumerHandlerResult<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerInferHandlerResult<InferConsumer<TContract, TName>>;

/**
 * Worker perspective - consumer handler type
 */
export type WorkerInferConsumerHandler<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> = ConsumerHandler<InferConsumer<TContract, TName>>;

/**
 * Map of all consumer handlers for a contract
 */
export type WorkerInferConsumerHandlers<TContract extends ContractDefinition> = {
  [K in InferConsumerNames<TContract>]: WorkerInferConsumerHandler<TContract, K>;
};
