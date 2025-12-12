import type {
  AnySchema,
  BindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  ExchangeDefinition,
  ExchangeType,
  PublisherDefinition,
  QueueDefinition,
} from "./types.js";

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
  options?: Omit<BindingDefinition, "queue" | "exchange">,
): BindingDefinition {
  return {
    queue,
    exchange,
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
  TExchanges extends Record<string, ExchangeDefinition> = Record<string, ExchangeDefinition>,
  TQueues extends Record<string, QueueDefinition> = Record<string, QueueDefinition>,
  TBindings extends Record<string, BindingDefinition> = Record<string, BindingDefinition>,
  TPublishers extends Record<string, PublisherDefinition> = Record<string, PublisherDefinition>,
  TConsumers extends Record<string, ConsumerDefinition> = Record<string, ConsumerDefinition>,
>(
  definition: ContractDefinition<TExchanges, TQueues, TBindings, TPublishers, TConsumers>,
): ContractDefinition<TExchanges, TQueues, TBindings, TPublishers, TConsumers> {
  return definition;
}
