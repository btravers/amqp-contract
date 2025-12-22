import type {
  AnySchema,
  BindingDefinition,
  QueueBindingDefinition,
  ExchangeBindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  ExchangeDefinition,
  ExchangeType,
  PublisherDefinition,
  QueueDefinition,
} from "./types.js";

/**
 * Message schema with metadata
 */
export interface MessageSchema<TSchema extends AnySchema = AnySchema> extends AnySchema {
  readonly name: string;
  readonly schema: TSchema;
  readonly "~standard": TSchema["~standard"];
}

/**
 * Define a message schema with metadata
 */
export function defineMessage<TSchema extends AnySchema>(
  name: string,
  schema: TSchema,
): MessageSchema<TSchema> {
  return {
    name,
    schema,
    "~standard": schema["~standard"],
  };
}

/**
 * Define an AMQP exchange
 */
export function defineExchange(
  name: string,
  type: ExchangeType,
  options?: Omit<ExchangeDefinition, "name" | "type">,
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
 * Define a binding between queue and exchange
 */
export function defineBinding(
  queue: string,
  exchange: string,
  options?: Omit<QueueBindingDefinition, "type" | "queue" | "exchange">,
): QueueBindingDefinition {
  return {
    type: "queue",
    queue,
    exchange,
    ...options,
  };
}

/**
 * Define a binding between exchange and exchange (source -> destination)
 */
export function defineExchangeBinding(
  destination: string,
  source: string,
  options?: Omit<ExchangeBindingDefinition, "type" | "source" | "destination">,
): ExchangeBindingDefinition {
  return {
    type: "exchange",
    source,
    destination,
    ...options,
  };
}

/**
 * Define a message publisher
 */
export function definePublisher<TMessageSchema extends AnySchema>(
  exchange: string,
  message: TMessageSchema,
  options?: Omit<PublisherDefinition<TMessageSchema>, "exchange" | "message">,
): PublisherDefinition<TMessageSchema> {
  return {
    exchange,
    message,
    ...options,
  };
}

/**
 * Define a message consumer
 */
export function defineConsumer<
  TMessageSchema extends AnySchema,
  THandlerResultSchema extends AnySchema = AnySchema,
>(
  queue: string,
  message: TMessageSchema,
  options?: Omit<ConsumerDefinition<TMessageSchema, THandlerResultSchema>, "queue" | "message">,
): ConsumerDefinition<TMessageSchema, THandlerResultSchema> {
  return {
    queue,
    message,
    ...options,
  };
}

/**
 * Define an AMQP contract
 */
export function defineContract<
  TContract extends ContractDefinition<TExchanges, TQueues, TBindings, TPublishers, TConsumers>,
  TExchanges extends Record<string, ExchangeDefinition> = Record<string, ExchangeDefinition>,
  TQueues extends Record<string, QueueDefinition> = Record<string, QueueDefinition>,
  TBindings extends Record<string, BindingDefinition> = Record<string, BindingDefinition>,
  TPublishers extends Record<string, PublisherDefinition> = Record<string, PublisherDefinition>,
  TConsumers extends Record<string, ConsumerDefinition> = Record<string, ConsumerDefinition>,
>(definition: TContract): TContract {
  return definition;
}
