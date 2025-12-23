import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  QueueBindingDefinition,
  ExchangeBindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  ExchangeDefinition,
  PublisherDefinition,
  QueueDefinition,
  MessageDefinition,
  FanoutExchangeDefinition,
  TopicExchangeDefinition,
  DirectExchangeDefinition,
  BaseExchangeDefinition,
} from "./types.js";

export function defineExchange(
  name: string,
  type: "fanout",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): FanoutExchangeDefinition;

export function defineExchange(
  name: string,
  type: "direct",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): DirectExchangeDefinition;

export function defineExchange(
  name: string,
  type: "topic",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): TopicExchangeDefinition;

/**
 * Define an AMQP exchange
 */
export function defineExchange(
  name: string,
  type: "fanout" | "direct" | "topic",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): ExchangeDefinition {
  return {
    name,
    type,
    ...options,
  };
}

/**
 * Define an AMQP queue
 */
export function defineQueue(
  name: string,
  options?: Omit<QueueDefinition, "name">,
): QueueDefinition {
  return {
    name,
    ...options,
  };
}

/**
 * Define a message definition with payload and optional headers/metadata
 */
export function defineMessage<
  TPayload extends MessageDefinition["payload"],
  THeaders extends StandardSchemaV1<Record<string, unknown>> | undefined = undefined,
>(
  payload: TPayload,
  options?: {
    headers?: THeaders;
    summary?: string;
    description?: string;
  },
): MessageDefinition<TPayload, THeaders> {
  return {
    payload,
    ...options,
  };
}

/**
 * Define a binding between queue and fanout exchange (exchange -> queue)
 * Fanout exchanges don't use routing keys
 */
export function defineQueueBinding(
  queue: QueueDefinition,
  exchange: FanoutExchangeDefinition,
  options?: Omit<
    Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>,
    "type" | "queue" | "exchange" | "routingKey"
  >,
): Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>;

/**
 * Define a binding between queue and direct/topic exchange (exchange -> queue)
 * Direct and topic exchanges require a routing key
 */
export function defineQueueBinding(
  queue: QueueDefinition,
  exchange: DirectExchangeDefinition | TopicExchangeDefinition,
  options: Omit<
    Extract<
      QueueBindingDefinition,
      { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
    >,
    "type" | "queue" | "exchange"
  >,
): Extract<
  QueueBindingDefinition,
  { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
>;

/**
 * Define a binding between queue and exchange (exchange -> queue)
 */
export function defineQueueBinding(
  queue: QueueDefinition,
  exchange: ExchangeDefinition,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): QueueBindingDefinition {
  if (exchange.type === "fanout") {
    return {
      type: "queue",
      queue,
      exchange,
      ...(options?.arguments && { arguments: options.arguments }),
    } as QueueBindingDefinition;
  }

  return {
    type: "queue",
    queue,
    exchange,
    routingKey: options?.routingKey,
    ...(options?.arguments && { arguments: options.arguments }),
  } as QueueBindingDefinition;
}

/**
 * Define a binding between fanout exchange and exchange (source -> destination)
 * Fanout exchanges don't use routing keys
 */
export function defineExchangeBinding(
  destination: ExchangeDefinition,
  source: FanoutExchangeDefinition,
  options?: Omit<
    Extract<ExchangeBindingDefinition, { source: FanoutExchangeDefinition }>,
    "type" | "source" | "destination" | "routingKey"
  >,
): Extract<ExchangeBindingDefinition, { source: FanoutExchangeDefinition }>;

/**
 * Define a binding between direct/topic exchange and exchange (source -> destination)
 * Direct and topic exchanges require a routing key
 */
export function defineExchangeBinding(
  destination: ExchangeDefinition,
  source: DirectExchangeDefinition | TopicExchangeDefinition,
  options: Omit<
    Extract<
      ExchangeBindingDefinition,
      { source: DirectExchangeDefinition | TopicExchangeDefinition }
    >,
    "type" | "source" | "destination"
  >,
): Extract<
  ExchangeBindingDefinition,
  { source: DirectExchangeDefinition | TopicExchangeDefinition }
>;

/**
 * Define a binding between exchange and exchange (source -> destination)
 */
export function defineExchangeBinding(
  destination: ExchangeDefinition,
  source: ExchangeDefinition,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): ExchangeBindingDefinition {
  if (source.type === "fanout") {
    return {
      type: "exchange",
      source,
      destination,
      ...(options?.arguments && { arguments: options.arguments }),
    } as ExchangeBindingDefinition;
  }

  return {
    type: "exchange",
    source,
    destination,
    routingKey: options?.routingKey ?? "",
    ...(options?.arguments && { arguments: options.arguments }),
  } as ExchangeBindingDefinition;
}

/**
 * Define a message publisher for fanout exchange
 * Fanout exchanges don't use routing keys
 */
export function definePublisher<TMessage extends MessageDefinition>(
  exchange: FanoutExchangeDefinition,
  message: TMessage,
  options?: Omit<
    Extract<PublisherDefinition<TMessage>, { exchange: FanoutExchangeDefinition }>,
    "exchange" | "message" | "routingKey"
  >,
): Extract<PublisherDefinition<TMessage>, { exchange: FanoutExchangeDefinition }>;

/**
 * Define a message publisher for direct/topic exchange
 * Direct and topic exchanges require a routing key
 */
export function definePublisher<TMessage extends MessageDefinition>(
  exchange: DirectExchangeDefinition | TopicExchangeDefinition,
  message: TMessage,
  options: Omit<
    Extract<
      PublisherDefinition<TMessage>,
      { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
    >,
    "exchange" | "message"
  >,
): Extract<
  PublisherDefinition<TMessage>,
  { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
>;

/**
 * Define a message publisher
 */
export function definePublisher<TMessage extends MessageDefinition>(
  exchange: ExchangeDefinition,
  message: TMessage,
  options?: { routingKey?: string },
): PublisherDefinition<TMessage> {
  if (exchange.type === "fanout") {
    return {
      exchange,
      message,
    } as PublisherDefinition<TMessage>;
  }

  return {
    exchange,
    message,
    routingKey: options?.routingKey ?? "",
  } as PublisherDefinition<TMessage>;
}

/**
 * Define a message consumer
 */
export function defineConsumer<TMessage extends MessageDefinition>(
  queue: QueueDefinition,
  message: TMessage,
  options?: Omit<ConsumerDefinition<TMessage>, "queue" | "message">,
): ConsumerDefinition<TMessage> {
  return {
    queue,
    message,
    ...options,
  };
}

/**
 * Define an AMQP contract
 */
export function defineContract<TContract extends ContractDefinition>(
  definition: TContract,
): TContract {
  return definition;
}
