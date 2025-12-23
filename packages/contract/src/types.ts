import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Any schema that conforms to Standard Schema v1
 */
export type AnySchema = StandardSchemaV1;

/**
 * Definition of an AMQP exchange
 */
export type BaseExchangeDefinition = {
  name: string;
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  arguments?: Record<string, unknown>;
};

export type FanoutExchangeDefinition = BaseExchangeDefinition & {
  type: "fanout";
};

export type DirectExchangeDefinition = BaseExchangeDefinition & {
  type: "direct";
};

export type TopicExchangeDefinition = BaseExchangeDefinition & {
  type: "topic";
};

export type ExchangeDefinition =
  | FanoutExchangeDefinition
  | DirectExchangeDefinition
  | TopicExchangeDefinition;

/**
 * Definition of an AMQP queue
 */
export type QueueDefinition = {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, unknown>;
};

export type MessageDefinition<
  TPayload extends AnySchema = AnySchema,
  THeaders extends StandardSchemaV1<Record<string, unknown>> | undefined = undefined,
> = {
  payload: TPayload;
  headers?: THeaders;
  summary?: string;
  description?: string;
};

/**
 * Binding between queue and exchange
 */
export type QueueBindingDefinition = {
  type: "queue";
  queue: QueueDefinition;
  arguments?: Record<string, unknown>;
} & (
  | {
      exchange: DirectExchangeDefinition | TopicExchangeDefinition;
      routingKey: string;
    }
  | {
      exchange: FanoutExchangeDefinition;
      routingKey?: never;
    }
);

/**
 * Binding between exchange and exchange
 */
export type ExchangeBindingDefinition = {
  type: "exchange";
  destination: ExchangeDefinition;
  arguments?: Record<string, unknown>;
} & (
  | {
      source: DirectExchangeDefinition | TopicExchangeDefinition;
      routingKey: string;
    }
  | {
      source: FanoutExchangeDefinition;
      routingKey?: never;
    }
);

/**
 * Binding definition - can be either queue-to-exchange or exchange-to-exchange
 */
export type BindingDefinition = QueueBindingDefinition | ExchangeBindingDefinition;

/**
 * Definition of a message publisher
 */
export type PublisherDefinition<TMessage extends MessageDefinition = MessageDefinition> = {
  message: TMessage;
} & (
  | {
      exchange: DirectExchangeDefinition | TopicExchangeDefinition;
      routingKey: string;
    }
  | {
      exchange: FanoutExchangeDefinition;
      routingKey?: never;
    }
);

/**
 * Definition of a message consumer
 */
export type ConsumerDefinition<TMessage extends MessageDefinition = MessageDefinition> = {
  queue: QueueDefinition;
  message: TMessage;
  prefetch?: number;
  noAck?: boolean;
};

/**
 * Contract definition containing all AMQP resources
 */
export type ContractDefinition = {
  exchanges?: Record<string, ExchangeDefinition>;
  queues?: Record<string, QueueDefinition>;
  bindings?: Record<string, BindingDefinition>;
  publishers?: Record<string, PublisherDefinition>;
  consumers?: Record<string, ConsumerDefinition>;
};

/**
 * Infer publisher names from a contract
 */
export type InferPublisherNames<TContract extends ContractDefinition> =
  TContract["publishers"] extends Record<string, unknown> ? keyof TContract["publishers"] : never;

/**
 * Infer consumer names from a contract
 */
export type InferConsumerNames<TContract extends ContractDefinition> =
  TContract["consumers"] extends Record<string, unknown> ? keyof TContract["consumers"] : never;

/**
 * Infer publisher input type (message payload) for a specific publisher in a contract
 */
export type ClientInferPublisherInput<
  TContract extends ContractDefinition,
  TName extends InferPublisherNames<TContract>,
> =
  TContract["publishers"] extends Record<string, PublisherDefinition>
    ? TContract["publishers"][TName] extends PublisherDefinition<infer TMessage>
      ? TMessage["payload"] extends { "~standard": { types?: { input: infer TInput } } }
        ? TInput
        : never
      : never
    : never;

/**
 * Infer consumer input type (message payload) for a specific consumer in a contract
 */
export type WorkerInferConsumerInput<
  TContract extends ContractDefinition,
  TName extends InferConsumerNames<TContract>,
> =
  TContract["consumers"] extends Record<string, ConsumerDefinition>
    ? TContract["consumers"][TName] extends ConsumerDefinition<infer TMessage>
      ? TMessage["payload"] extends { "~standard": { types?: { input: infer TInput } } }
        ? TInput
        : never
      : never
    : never;

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
