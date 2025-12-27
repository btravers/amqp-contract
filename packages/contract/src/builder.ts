import type {
  BaseExchangeDefinition,
  ConsumerDefinition,
  ContractDefinition,
  DirectExchangeDefinition,
  ExchangeBindingDefinition,
  ExchangeDefinition,
  FanoutExchangeDefinition,
  MessageDefinition,
  PublisherDefinition,
  QueueBindingDefinition,
  QueueDefinition,
  TopicExchangeDefinition,
} from "./types.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Define a fanout exchange.
 *
 * A fanout exchange routes messages to all bound queues without considering routing keys.
 * This exchange type is ideal for broadcasting messages to multiple consumers.
 *
 * @param name - The name of the exchange
 * @param type - Must be "fanout"
 * @param options - Optional exchange configuration
 * @param options.durable - If true, the exchange survives broker restarts (default: false)
 * @param options.autoDelete - If true, the exchange is deleted when no queues are bound (default: false)
 * @param options.internal - If true, the exchange cannot be directly published to (default: false)
 * @param options.arguments - Additional AMQP arguments for the exchange
 * @returns A fanout exchange definition
 *
 * @example
 * ```typescript
 * const logsExchange = defineExchange('logs', 'fanout', {
 *   durable: true
 * });
 * ```
 */
export function defineExchange(
  name: string,
  type: "fanout",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): FanoutExchangeDefinition;

/**
 * Define a direct exchange.
 *
 * A direct exchange routes messages to queues based on exact routing key matches.
 * This exchange type is ideal for point-to-point messaging.
 *
 * @param name - The name of the exchange
 * @param type - Must be "direct"
 * @param options - Optional exchange configuration
 * @param options.durable - If true, the exchange survives broker restarts (default: false)
 * @param options.autoDelete - If true, the exchange is deleted when no queues are bound (default: false)
 * @param options.internal - If true, the exchange cannot be directly published to (default: false)
 * @param options.arguments - Additional AMQP arguments for the exchange
 * @returns A direct exchange definition
 *
 * @example
 * ```typescript
 * const tasksExchange = defineExchange('tasks', 'direct', {
 *   durable: true
 * });
 * ```
 */
export function defineExchange(
  name: string,
  type: "direct",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): DirectExchangeDefinition;

/**
 * Define a topic exchange.
 *
 * A topic exchange routes messages to queues based on routing key patterns.
 * Routing keys can use wildcards: `*` matches one word, `#` matches zero or more words.
 * This exchange type is ideal for flexible message routing based on hierarchical topics.
 *
 * @param name - The name of the exchange
 * @param type - Must be "topic"
 * @param options - Optional exchange configuration
 * @param options.durable - If true, the exchange survives broker restarts (default: false)
 * @param options.autoDelete - If true, the exchange is deleted when no queues are bound (default: false)
 * @param options.internal - If true, the exchange cannot be directly published to (default: false)
 * @param options.arguments - Additional AMQP arguments for the exchange
 * @returns A topic exchange definition
 *
 * @example
 * ```typescript
 * const ordersExchange = defineExchange('orders', 'topic', {
 *   durable: true
 * });
 * ```
 */
export function defineExchange(
  name: string,
  type: "topic",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): TopicExchangeDefinition;

/**
 * Define an AMQP exchange.
 *
 * An exchange receives messages from publishers and routes them to queues based on the exchange type
 * and routing rules. This is the implementation function - use the type-specific overloads for better
 * type safety.
 *
 * @param name - The name of the exchange
 * @param type - The type of exchange: "fanout", "direct", or "topic"
 * @param options - Optional exchange configuration
 * @returns An exchange definition
 * @internal
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
 * Define an AMQP queue.
 *
 * A queue stores messages until they are consumed by workers. Queues can be bound to exchanges
 * to receive messages based on routing rules.
 *
 * @param name - The name of the queue
 * @param options - Optional queue configuration
 * @param options.durable - If true, the queue survives broker restarts (default: false)
 * @param options.exclusive - If true, the queue can only be used by the declaring connection (default: false)
 * @param options.autoDelete - If true, the queue is deleted when the last consumer unsubscribes (default: false)
 * @param options.arguments - Additional AMQP arguments (e.g., x-message-ttl, x-dead-letter-exchange)
 * @returns A queue definition
 *
 * @example
 * ```typescript
 * const orderProcessingQueue = defineQueue('order-processing', {
 *   durable: true,
 *   arguments: {
 *     'x-message-ttl': 86400000, // 24 hours
 *     'x-dead-letter-exchange': 'orders-dlx'
 *   }
 * });
 * ```
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
 * Define a message definition with payload and optional headers/metadata.
 *
 * A message definition specifies the schema for message payloads and headers using
 * Standard Schema v1 compatible libraries (Zod, Valibot, ArkType, etc.).
 * The schemas are used for automatic validation when publishing or consuming messages.
 *
 * @param payload - The payload schema (must be Standard Schema v1 compatible)
 * @param options - Optional message metadata
 * @param options.headers - Optional header schema for message headers
 * @param options.summary - Brief description for documentation (used in AsyncAPI generation)
 * @param options.description - Detailed description for documentation (used in AsyncAPI generation)
 * @returns A message definition with inferred types
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string().uuid(),
 *     customerId: z.string().uuid(),
 *     amount: z.number().positive(),
 *     items: z.array(z.object({
 *       productId: z.string(),
 *       quantity: z.number().int().positive(),
 *     })),
 *   }),
 *   {
 *     summary: 'Order created event',
 *     description: 'Emitted when a new order is created in the system'
 *   }
 * );
 * ```
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
 * Define a binding between a queue and a fanout exchange.
 *
 * Binds a queue to a fanout exchange to receive all messages published to the exchange.
 * Fanout exchanges ignore routing keys, so this overload doesn't require one.
 *
 * @param queue - The queue definition to bind
 * @param exchange - The fanout exchange definition
 * @param options - Optional binding configuration
 * @param options.arguments - Additional AMQP arguments for the binding
 * @returns A queue binding definition
 *
 * @example
 * ```typescript
 * const logsQueue = defineQueue('logs-queue', { durable: true });
 * const logsExchange = defineExchange('logs', 'fanout', { durable: true });
 *
 * const binding = defineQueueBinding(logsQueue, logsExchange);
 * ```
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
 * Define a binding between a queue and a direct or topic exchange.
 *
 * Binds a queue to an exchange with a specific routing key pattern.
 * Messages are only routed to the queue if the routing key matches the pattern.
 *
 * For direct exchanges: The routing key must match exactly.
 * For topic exchanges: The routing key can include wildcards:
 * - `*` matches exactly one word
 * - `#` matches zero or more words
 *
 * @param queue - The queue definition to bind
 * @param exchange - The direct or topic exchange definition
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The routing key pattern for message routing
 * @param options.arguments - Additional AMQP arguments for the binding
 * @returns A queue binding definition
 *
 * @example
 * ```typescript
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 *
 * // Bind with exact routing key
 * const binding = defineQueueBinding(orderQueue, ordersExchange, {
 *   routingKey: 'order.created'
 * });
 *
 * // Bind with wildcard pattern
 * const allOrdersBinding = defineQueueBinding(orderQueue, ordersExchange, {
 *   routingKey: 'order.*'  // Matches order.created, order.updated, etc.
 * });
 * ```
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
 * Define a binding between a queue and an exchange.
 *
 * This is the implementation function - use the type-specific overloads for better type safety.
 *
 * @param queue - The queue definition to bind
 * @param exchange - The exchange definition
 * @param options - Optional binding configuration
 * @returns A queue binding definition
 * @internal
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
 * Define a binding between two exchanges (exchange-to-exchange routing).
 *
 * Binds a destination exchange to a fanout source exchange.
 * Messages published to the source exchange will be forwarded to the destination exchange.
 * Fanout exchanges ignore routing keys, so this overload doesn't require one.
 *
 * @param destination - The destination exchange definition
 * @param source - The fanout source exchange definition
 * @param options - Optional binding configuration
 * @param options.arguments - Additional AMQP arguments for the binding
 * @returns An exchange binding definition
 *
 * @example
 * ```typescript
 * const sourceExchange = defineExchange('logs', 'fanout', { durable: true });
 * const destExchange = defineExchange('all-logs', 'fanout', { durable: true });
 *
 * const binding = defineExchangeBinding(destExchange, sourceExchange);
 * ```
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
 * Define a binding between two exchanges (exchange-to-exchange routing).
 *
 * Binds a destination exchange to a direct or topic source exchange with a routing key pattern.
 * Messages are forwarded from source to destination only if the routing key matches the pattern.
 *
 * @param destination - The destination exchange definition
 * @param source - The direct or topic source exchange definition
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The routing key pattern for message routing
 * @param options.arguments - Additional AMQP arguments for the binding
 * @returns An exchange binding definition
 *
 * @example
 * ```typescript
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const importantExchange = defineExchange('important-orders', 'topic', { durable: true });
 *
 * // Forward only high-value orders
 * const binding = defineExchangeBinding(importantExchange, ordersExchange, {
 *   routingKey: 'order.high-value.*'
 * });
 * ```
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
 * Define a binding between two exchanges (exchange-to-exchange routing).
 *
 * This is the implementation function - use the type-specific overloads for better type safety.
 *
 * @param destination - The destination exchange definition
 * @param source - The source exchange definition
 * @param options - Optional binding configuration
 * @returns An exchange binding definition
 * @internal
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
 * Define a message publisher for a fanout exchange.
 *
 * A publisher sends messages to an exchange. For fanout exchanges, messages are broadcast
 * to all bound queues regardless of routing key, so no routing key is required.
 *
 * The message schema is validated when publishing to ensure type safety.
 *
 * @param exchange - The fanout exchange definition to publish to
 * @param message - The message definition with payload schema
 * @param options - Optional publisher configuration
 * @returns A publisher definition with inferred message types
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const logsExchange = defineExchange('logs', 'fanout', { durable: true });
 * const logMessage = defineMessage(
 *   z.object({
 *     level: z.enum(['info', 'warn', 'error']),
 *     message: z.string(),
 *     timestamp: z.string().datetime(),
 *   })
 * );
 *
 * const logPublisher = definePublisher(logsExchange, logMessage);
 * ```
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
 * Define a message publisher for a direct or topic exchange.
 *
 * A publisher sends messages to an exchange with a specific routing key.
 * The routing key determines which queues receive the message.
 *
 * The message schema is validated when publishing to ensure type safety.
 *
 * @param exchange - The direct or topic exchange definition to publish to
 * @param message - The message definition with payload schema
 * @param options - Publisher configuration (routingKey is required)
 * @param options.routingKey - The routing key for message routing
 * @returns A publisher definition with inferred message types
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string().uuid(),
 *     amount: z.number().positive(),
 *   }),
 *   {
 *     summary: 'Order created event',
 *     description: 'Emitted when a new order is created'
 *   }
 * );
 *
 * const orderCreatedPublisher = definePublisher(ordersExchange, orderMessage, {
 *   routingKey: 'order.created'
 * });
 * ```
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
 * Define a message publisher.
 *
 * This is the implementation function - use the type-specific overloads for better type safety.
 *
 * @param exchange - The exchange definition
 * @param message - The message definition
 * @param options - Optional publisher configuration
 * @returns A publisher definition
 * @internal
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
 * Define a message consumer.
 *
 * A consumer receives and processes messages from a queue. The message schema is validated
 * automatically when messages are consumed, ensuring type safety for your handlers.
 *
 * Consumers are associated with a specific queue and message type. When you create a worker
 * with this consumer, it will process messages from the queue according to the schema.
 *
 * @param queue - The queue definition to consume from
 * @param message - The message definition with payload schema
 * @param options - Optional consumer configuration
 * @returns A consumer definition with inferred message types
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string().uuid(),
 *     customerId: z.string().uuid(),
 *     amount: z.number().positive(),
 *   })
 * );
 *
 * const processOrderConsumer = defineConsumer(orderQueue, orderMessage);
 *
 * // Later, when creating a worker, you'll provide a handler for this consumer:
 * // const worker = await TypedAmqpWorker.create({
 * //   contract,
 * //   handlers: {
 * //     processOrder: async (message) => {
 * //       // message is automatically typed based on the schema
 * //       console.log(message.orderId); // string
 * //     }
 * //   },
 * //   connection
 * // });
 * ```
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
 * Define an AMQP contract.
 *
 * A contract is the central definition of your AMQP messaging topology. It brings together
 * all exchanges, queues, bindings, publishers, and consumers in a single, type-safe definition.
 *
 * The contract is used by both clients (for publishing) and workers (for consuming) to ensure
 * type safety throughout your messaging infrastructure. TypeScript will infer all message types
 * and publisher/consumer names from the contract.
 *
 * @param definition - The contract definition containing all AMQP resources
 * @param definition.exchanges - Named exchange definitions
 * @param definition.queues - Named queue definitions
 * @param definition.bindings - Named binding definitions (queue-to-exchange or exchange-to-exchange)
 * @param definition.publishers - Named publisher definitions for sending messages
 * @param definition.consumers - Named consumer definitions for receiving messages
 * @returns The same contract definition with full type inference
 *
 * @example
 * ```typescript
 * import {
 *   defineContract,
 *   defineExchange,
 *   defineQueue,
 *   defineQueueBinding,
 *   definePublisher,
 *   defineConsumer,
 *   defineMessage,
 * } from '@amqp-contract/contract';
 * import { z } from 'zod';
 *
 * // Define resources
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   })
 * );
 *
 * // Compose contract
 * export const contract = defineContract({
 *   exchanges: {
 *     orders: ordersExchange,
 *   },
 *   queues: {
 *     orderProcessing: orderQueue,
 *   },
 *   bindings: {
 *     orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
 *       routingKey: 'order.created',
 *     }),
 *   },
 *   publishers: {
 *     orderCreated: definePublisher(ordersExchange, orderMessage, {
 *       routingKey: 'order.created',
 *     }),
 *   },
 *   consumers: {
 *     processOrder: defineConsumer(orderQueue, orderMessage),
 *   },
 * });
 *
 * // TypeScript now knows:
 * // - client.publish('orderCreated', { orderId: string, amount: number })
 * // - handler: async (message: { orderId: string, amount: number }) => void
 * ```
 */
export function defineContract<TContract extends ContractDefinition>(
  definition: TContract,
): TContract {
  return definition;
}

/**
 * Helper to call definePublisher with proper type handling.
 * Type safety is enforced by overloaded public function signatures.
 * @internal
 */
function callDefinePublisher<TMessage extends MessageDefinition>(
  exchange: ExchangeDefinition,
  message: TMessage,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): PublisherDefinition<TMessage> {
  // Type assertion is safe because overloaded signatures enforce routingKey requirement
  if (exchange.type === "fanout") {
    return definePublisher(exchange, message, options);
  }
  return definePublisher(exchange, message, options as { routingKey: string });
}

/**
 * Helper to call defineQueueBinding with proper type handling.
 * Type safety is enforced by overloaded public function signatures.
 * @internal
 */
function callDefineQueueBinding(
  queue: QueueDefinition,
  exchange: ExchangeDefinition,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): QueueBindingDefinition {
  // Type assertion is safe because overloaded signatures enforce routingKey requirement
  if (exchange.type === "fanout") {
    return defineQueueBinding(queue, exchange, options);
  }
  return defineQueueBinding(queue, exchange, options as { routingKey: string });
}

/**
 * Publisher-first builder result for fanout and direct exchanges.
 *
 * This type represents a publisher and provides a method to create
 * a consumer that uses the same message schema with a binding to the exchange.
 *
 * This pattern is suitable for event-oriented messaging where publishers
 * emit events without knowing which queues will consume them.
 *
 * @template TMessage - The message definition
 * @template TPublisher - The publisher definition
 */
export type PublisherFirstResult<
  TMessage extends MessageDefinition,
  TPublisher extends PublisherDefinition<TMessage>,
> = {
  /** The publisher definition */
  publisher: TPublisher;
  /**
   * Create a consumer that receives messages from this publisher.
   * The consumer will automatically use the same message schema and
   * a binding will be created with the same routing key.
   *
   * @param queue - The queue that will consume the messages
   * @returns An object with the consumer definition and binding
   */
  createConsumer: (queue: QueueDefinition) => {
    consumer: ConsumerDefinition<TMessage>;
    binding: QueueBindingDefinition;
  };
};

// fixme: implement ExtractConsumerRoutingKeyFromPublisherRoutingKey for topic exchanges
/**
 * Extract the routing key type that consumers can use based on a publisher's routing key.
 * For topic exchanges:
 * - If publisher has a concrete key (no wildcards), consumers can use patterns that would match it
 * - Patterns are validated at the type level to ensure compliance with AMQP routing
 * @internal
 */
type ExtractConsumerRoutingKeyFromPublisherRoutingKey<TRoutingKey extends string> =
  TRoutingKey extends `${infer _Prefix}.*${infer _Suffix}`
    ? TRoutingKey
    : TRoutingKey extends `${infer _Prefix}#${infer _Suffix}`
      ? TRoutingKey
      : string;

/**
 * Publisher-first builder result for topic exchanges.
 *
 * This type represents a publisher with a concrete routing key and provides a method
 * to create consumers that can use routing key patterns matching the publisher's key.
 *
 * @template TMessage - The message definition
 * @template TPublisher - The publisher definition
 * @template TRoutingKey - The literal routing key type from the publisher (for documentation purposes)
 */
export type PublisherFirstResultWithRoutingKey<
  TMessage extends MessageDefinition,
  TPublisher extends PublisherDefinition<TMessage>,
  TRoutingKey extends string,
> = {
  /** The publisher definition */
  publisher: TPublisher;
  /**
   * Create a consumer that receives messages from this publisher.
   * For topic exchanges, the routing key pattern can be specified for the binding.
   *
   * @param queue - The queue that will consume the messages
   * @param routingKey - Optional routing key pattern for the binding (defaults to publisher's routing key)
   * @returns An object with the consumer definition and binding
   */
  createConsumer: (
    queue: QueueDefinition,
    routingKey?: ExtractConsumerRoutingKeyFromPublisherRoutingKey<TRoutingKey>,
  ) => {
    consumer: ConsumerDefinition<TMessage>;
    binding: QueueBindingDefinition;
  };
};

/**
 * Define a publisher-first relationship for event-oriented messaging.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the publisher and consumer use the same message schema
 * 2. Linking the routing key from the publisher to the binding
 *
 * Use this pattern for events where publishers don't need to know about queues.
 * Multiple consumers can be created for different queues, all using the same message schema.
 *
 * @param exchange - The exchange to publish to (fanout type)
 * @param message - The message definition (schema and metadata)
 * @param options - Optional binding configuration
 * @returns A publisher-first result with publisher and consumer factory
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const logsExchange = defineExchange('logs', 'fanout', { durable: true });
 * const logMessage = defineMessage(
 *   z.object({
 *     level: z.enum(['info', 'warn', 'error']),
 *     message: z.string(),
 *   })
 * );
 *
 * // Create publisher-first relationship (event pattern)
 * const logEvent = definePublisherFirst(logsExchange, logMessage);
 *
 * // Multiple queues can consume the same event
 * const logsQueue1 = defineQueue('logs-queue-1', { durable: true });
 * const logsQueue2 = defineQueue('logs-queue-2', { durable: true });
 *
 * // Use in contract
 * const { consumer: consumer1, binding: binding1 } = logEvent.createConsumer(logsQueue1);
 * const { consumer: consumer2, binding: binding2 } = logEvent.createConsumer(logsQueue2);
 *
 * const contract = defineContract({
 *   exchanges: { logs: logsExchange },
 *   queues: { logsQueue1, logsQueue2 },
 *   bindings: {
 *     logBinding1: binding1,
 *     logBinding2: binding2,
 *   },
 *   publishers: { publishLog: logEvent.publisher },
 *   consumers: {
 *     consumeLog1: consumer1,
 *     consumeLog2: consumer2,
 *   },
 * });
 * ```
 */
export function definePublisherFirst<TMessage extends MessageDefinition>(
  exchange: FanoutExchangeDefinition,
  message: TMessage,
  options?: Omit<
    Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>,
    "type" | "queue" | "exchange" | "routingKey"
  >,
): PublisherFirstResult<
  TMessage,
  Extract<PublisherDefinition<TMessage>, { exchange: FanoutExchangeDefinition }>
>;

/**
 * Define a publisher-first relationship for event-oriented messaging with direct exchange.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the publisher and consumer use the same message schema
 * 2. Linking the routing key from the publisher to the binding
 *
 * Use this pattern for events where publishers don't need to know about queues.
 * Multiple consumers can be created for different queues, all using the same message schema.
 *
 * @param exchange - The exchange to publish to (direct type)
 * @param message - The message definition (schema and metadata)
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The routing key for message routing
 * @returns A publisher-first result with publisher and consumer factory
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const tasksExchange = defineExchange('tasks', 'direct', { durable: true });
 * const taskMessage = defineMessage(
 *   z.object({
 *     taskId: z.string(),
 *     payload: z.record(z.unknown()),
 *   })
 * );
 *
 * // Create publisher-first relationship with routing key
 * const taskEvent = definePublisherFirst(
 *   tasksExchange,
 *   taskMessage,
 *   { routingKey: 'task.execute' }
 * );
 *
 * // Use in contract - routing key is consistent across publisher and bindings
 * const taskQueue = defineQueue('task-queue', { durable: true });
 * const { consumer, binding } = taskEvent.createConsumer(taskQueue);
 *
 * const contract = defineContract({
 *   exchanges: { tasks: tasksExchange },
 *   queues: { taskQueue },
 *   bindings: { taskBinding: binding },
 *   publishers: { executeTask: taskEvent.publisher },
 *   consumers: { processTask: consumer },
 * });
 * ```
 */
export function definePublisherFirst<
  TMessage extends MessageDefinition,
  TRoutingKey extends string,
>(
  exchange: DirectExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: TRoutingKey;
    arguments?: Record<string, unknown>;
  },
): PublisherFirstResult<
  TMessage,
  Extract<PublisherDefinition<TMessage>, { exchange: DirectExchangeDefinition }>
>;

/**
 * Define a publisher-first relationship for event-oriented messaging with topic exchange.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the publisher and consumer use the same message schema
 * 2. The publisher uses a concrete routing key (e.g., 'order.created')
 * 3. Consumers can optionally specify routing key patterns (e.g., 'order.*') or use the default
 *
 * Use this pattern for events where publishers emit with specific routing keys,
 * and consumers can subscribe with patterns. This is less common than the consumer-first pattern.
 *
 * @param exchange - The exchange to publish to (topic type)
 * @param message - The message definition (schema and metadata)
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The concrete routing key for the publisher
 * @returns A publisher-first result with publisher and consumer factory that accepts optional routing key patterns
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   })
 * );
 *
 * // Create publisher-first relationship with concrete routing key
 * const orderCreatedEvent = definePublisherFirst(
 *   ordersExchange,
 *   orderMessage,
 *   { routingKey: 'order.created' }  // Concrete key
 * );
 *
 * // Consumers can use patterns or specific keys
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const allOrdersQueue = defineQueue('all-orders', { durable: true });
 *
 * // Use in contract
 * const { consumer: processConsumer, binding: processBinding } =
 *   orderCreatedEvent.createConsumer(orderQueue);  // Uses 'order.created'
 * const { consumer: allOrdersConsumer, binding: allOrdersBinding } =
 *   orderCreatedEvent.createConsumer(allOrdersQueue, 'order.*');  // Uses pattern
 *
 * const contract = defineContract({
 *   exchanges: { orders: ordersExchange },
 *   queues: { orderQueue, allOrdersQueue },
 *   bindings: {
 *     orderBinding: processBinding,
 *     allOrdersBinding,
 *   },
 *   publishers: { orderCreated: orderCreatedEvent.publisher },
 *   consumers: {
 *     processOrder: processConsumer,
 *     trackAllOrders: allOrdersConsumer,
 *   },
 * });
 * ```
 */
export function definePublisherFirst<
  TMessage extends MessageDefinition,
  TRoutingKey extends string,
>(
  exchange: TopicExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: TRoutingKey;
    arguments?: Record<string, unknown>;
  },
): PublisherFirstResultWithRoutingKey<
  TMessage,
  Extract<PublisherDefinition<TMessage>, { exchange: TopicExchangeDefinition }>,
  TRoutingKey
>;

/**
 * Implementation of definePublisherFirst.
 * @internal
 */
export function definePublisherFirst<TMessage extends MessageDefinition>(
  exchange: ExchangeDefinition,
  message: TMessage,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
):
  | PublisherFirstResult<TMessage, PublisherDefinition<TMessage>>
  | PublisherFirstResultWithRoutingKey<TMessage, PublisherDefinition<TMessage>, string> {
  // Create the publisher
  const publisher = callDefinePublisher(exchange, message, options);

  // For topic exchanges, allow specifying routing key pattern when creating consumer
  if (exchange.type === "topic") {
    const createConsumer = (queue: QueueDefinition, routingKey?: string) => {
      const bindingOptions = routingKey ? { ...options, routingKey } : options;
      const binding = callDefineQueueBinding(queue, exchange, bindingOptions);
      const consumer = defineConsumer(queue, message);
      return {
        consumer,
        binding,
      };
    };

    return {
      publisher,
      createConsumer,
    } as PublisherFirstResultWithRoutingKey<TMessage, PublisherDefinition<TMessage>, string>;
  }

  // For fanout and direct exchanges, use the same routing key from publisher
  const createConsumer = (queue: QueueDefinition) => {
    const binding = callDefineQueueBinding(queue, exchange, options);
    const consumer = defineConsumer(queue, message);
    return {
      consumer,
      binding,
    };
  };

  return {
    publisher,
    createConsumer,
  } as PublisherFirstResult<TMessage, PublisherDefinition<TMessage>>;
}

/**
 * Consumer-first builder result for fanout and direct exchanges.
 *
 * This type represents a consumer with its binding and provides a method to create
 * a publisher that uses the same message schema and routing key.
 *
 * @template TMessage - The message definition
 * @template TConsumer - The consumer definition
 * @template TBinding - The queue binding definition
 */
export type ConsumerFirstResult<
  TMessage extends MessageDefinition,
  TConsumer extends ConsumerDefinition<TMessage>,
  TBinding extends QueueBindingDefinition,
> = {
  /** The consumer definition */
  consumer: TConsumer;
  /** The binding definition connecting the exchange to the queue */
  binding: TBinding;
  /**
   * Create a publisher that sends messages to this consumer.
   * The publisher will automatically use the same message schema and routing key.
   *
   * @returns A publisher definition with the same message type and routing key
   */
  createPublisher: () => TBinding["exchange"] extends FanoutExchangeDefinition
    ? Extract<PublisherDefinition<TMessage>, { exchange: FanoutExchangeDefinition }>
    : Extract<
        PublisherDefinition<TMessage>,
        { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
      >;
};

// fixme: implement ExtractPblisherRoutingKeyFromConsumerRoutingKey for topic exchanges
/**
 * Extract the routing key type that publishers can use based on a consumer's routing key pattern.
 * For topic exchanges:
 * - If consumer has a pattern with wildcards, publishers can use any concrete key (string)
 * - If consumer has a concrete key (no wildcards), publishers must use the exact same key
 * @internal
 */
type ExtractPublisherRoutingKeyFromConsumerRoutingKey<TRoutingKey extends string> =
  TRoutingKey extends `${infer _Prefix}.*${infer _Suffix}`
    ? string
    : TRoutingKey extends `${infer _Prefix}#${infer _Suffix}`
      ? string
      : TRoutingKey;

/**
 * Consumer-first builder result for topic exchanges.
 *
 * This type represents a consumer with its binding (which may use a pattern) and provides
 * a method to create a publisher with a concrete routing key that matches the pattern.
 *
 * @template TMessage - The message definition
 * @template TConsumer - The consumer definition
 * @template TBinding - The queue binding definition
 * @template TRoutingKey - The literal routing key type from the binding (for documentation purposes)
 */
export type ConsumerFirstResultWithRoutingKey<
  TMessage extends MessageDefinition,
  TConsumer extends ConsumerDefinition<TMessage>,
  TBinding extends QueueBindingDefinition,
  TRoutingKey extends string,
> = {
  /** The consumer definition */
  consumer: TConsumer;
  /** The binding definition connecting the exchange to the queue */
  binding: TBinding;
  /**
   * Create a publisher that sends messages to this consumer.
   * For topic exchanges, the routing key can be specified to match the binding pattern.
   *
   * @param routingKey - The concrete routing key that matches the binding pattern
   * @returns A publisher definition with the specified routing key
   */
  createPublisher: (
    routingKey: ExtractPublisherRoutingKeyFromConsumerRoutingKey<TRoutingKey>,
  ) => PublisherDefinition<TMessage>;
};

/**
 * Define a consumer-first relationship between a consumer and publisher.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the consumer and publisher use the same message schema
 * 2. Linking the routing key from the binding to the publisher
 * 3. Creating a binding that connects the exchange to the queue
 *
 * Use this when you want to start with a consumer and ensure publishers
 * send messages of the correct type.
 *
 * @param queue - The queue to consume from
 * @param exchange - The exchange that routes to the queue (fanout type)
 * @param message - The message definition (schema and metadata)
 * @param options - Optional binding configuration
 * @returns A consumer-first result with consumer, binding, and publisher factory
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const notificationsQueue = defineQueue('notifications', { durable: true });
 * const notificationsExchange = defineExchange('notifications', 'fanout', { durable: true });
 * const notificationMessage = defineMessage(
 *   z.object({
 *     userId: z.string(),
 *     message: z.string(),
 *   })
 * );
 *
 * // Create consumer-first relationship
 * const notificationConsumerFirst = defineConsumerFirst(
 *   notificationsQueue,
 *   notificationsExchange,
 *   notificationMessage
 * );
 *
 * // Use in contract
 * const contract = defineContract({
 *   exchanges: { notifications: notificationsExchange },
 *   queues: { notificationsQueue },
 *   bindings: { notificationBinding: notificationConsumerFirst.binding },
 *   publishers: { sendNotification: notificationConsumerFirst.createPublisher() },
 *   consumers: { processNotification: notificationConsumerFirst.consumer },
 * });
 * ```
 */
export function defineConsumerFirst<TMessage extends MessageDefinition>(
  queue: QueueDefinition,
  exchange: FanoutExchangeDefinition,
  message: TMessage,
  options?: Omit<
    Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>,
    "type" | "queue" | "exchange" | "routingKey"
  >,
): ConsumerFirstResult<
  TMessage,
  ConsumerDefinition<TMessage>,
  Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>
>;

/**
 * Define a consumer-first relationship between a consumer and publisher.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the consumer and publisher use the same message schema
 * 2. Linking the routing key from the binding to the publisher
 * 3. Creating a binding that connects the exchange to the queue
 *
 * Use this when you want to start with a consumer and ensure publishers
 * send messages with the correct type and routing key.
 *
 * @param queue - The queue to consume from
 * @param exchange - The exchange that routes to the queue (direct type)
 * @param message - The message definition (schema and metadata)
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The routing key for message routing
 * @returns A consumer-first result with consumer, binding, and publisher factory
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const taskQueue = defineQueue('tasks', { durable: true });
 * const tasksExchange = defineExchange('tasks', 'direct', { durable: true });
 * const taskMessage = defineMessage(
 *   z.object({
 *     taskId: z.string(),
 *     payload: z.record(z.unknown()),
 *   })
 * );
 *
 * // Create consumer-first relationship with routing key
 * const taskConsumerFirst = defineConsumerFirst(
 *   taskQueue,
 *   tasksExchange,
 *   taskMessage,
 *   { routingKey: 'task.execute' }
 * );
 *
 * // Use in contract - routing key is consistent across consumer and publisher
 * const contract = defineContract({
 *   exchanges: { tasks: tasksExchange },
 *   queues: { taskQueue },
 *   bindings: { taskBinding: taskConsumerFirst.binding },
 *   publishers: { executeTask: taskConsumerFirst.createPublisher() },
 *   consumers: { processTask: taskConsumerFirst.consumer },
 * });
 * ```
 */
export function defineConsumerFirst<TMessage extends MessageDefinition, TRoutingKey extends string>(
  queue: QueueDefinition,
  exchange: DirectExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: TRoutingKey;
    arguments?: Record<string, unknown>;
  },
): ConsumerFirstResult<
  TMessage,
  ConsumerDefinition<TMessage>,
  Extract<QueueBindingDefinition, { exchange: DirectExchangeDefinition }>
>;

/**
 * Define a consumer-first relationship between a consumer and publisher with topic exchange.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the consumer and publisher use the same message schema
 * 2. The binding uses a routing key pattern (e.g., 'order.*')
 * 3. The publisher factory accepts a concrete routing key that matches the pattern (e.g., 'order.created')
 *
 * Use this when you want to start with a consumer that uses a routing key pattern,
 * and allow publishers to specify concrete routing keys that match that pattern.
 *
 * @param queue - The queue to consume from
 * @param exchange - The exchange that routes to the queue (topic type)
 * @param message - The message definition (schema and metadata)
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The routing key pattern for the binding (can use wildcards)
 * @returns A consumer-first result with consumer, binding, and publisher factory that accepts a routing key
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   })
 * );
 *
 * // Create consumer-first relationship with pattern
 * const orderConsumerFirst = defineConsumerFirst(
 *   orderQueue,
 *   ordersExchange,
 *   orderMessage,
 *   { routingKey: 'order.*' }  // Pattern in binding
 * );
 *
 * // Use in contract - publisher can specify concrete routing key
 * const contract = defineContract({
 *   exchanges: { orders: ordersExchange },
 *   queues: { orderQueue },
 *   bindings: { orderBinding: orderConsumerFirst.binding },
 *   publishers: {
 *     orderCreated: orderConsumerFirst.createPublisher('order.created'),  // Concrete key
 *     orderUpdated: orderConsumerFirst.createPublisher('order.updated'),  // Concrete key
 *   },
 *   consumers: { processOrder: orderConsumerFirst.consumer },
 * });
 * ```
 */
export function defineConsumerFirst<TMessage extends MessageDefinition, TRoutingKey extends string>(
  queue: QueueDefinition,
  exchange: TopicExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: TRoutingKey;
    arguments?: Record<string, unknown>;
  },
): ConsumerFirstResultWithRoutingKey<
  TMessage,
  ConsumerDefinition<TMessage>,
  Extract<QueueBindingDefinition, { exchange: TopicExchangeDefinition }>,
  TRoutingKey
>;

/**
 * Implementation of defineConsumerFirst.
 * @internal
 */
export function defineConsumerFirst<TMessage extends MessageDefinition>(
  queue: QueueDefinition,
  exchange: ExchangeDefinition,
  message: TMessage,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
):
  | ConsumerFirstResult<TMessage, ConsumerDefinition<TMessage>, QueueBindingDefinition>
  | ConsumerFirstResultWithRoutingKey<
      TMessage,
      ConsumerDefinition<TMessage>,
      QueueBindingDefinition,
      string
    > {
  // Create the consumer
  const consumer = defineConsumer(queue, message);

  // Create the binding
  const binding = callDefineQueueBinding(queue, exchange, options);

  // For topic exchanges, allow specifying routing key when creating publisher
  if (exchange.type === "topic") {
    const createPublisher = (routingKey: string): PublisherDefinition<TMessage> => {
      return callDefinePublisher(exchange, message, { ...options, routingKey });
    };

    return {
      consumer,
      binding,
      createPublisher,
    } as ConsumerFirstResultWithRoutingKey<
      TMessage,
      ConsumerDefinition<TMessage>,
      QueueBindingDefinition,
      string
    >;
  }

  // For fanout and direct exchanges, use the same routing key from binding
  const createPublisher = () => {
    return callDefinePublisher(exchange, message, options);
  };

  return {
    consumer,
    binding,
    createPublisher,
  } as ConsumerFirstResult<TMessage, ConsumerDefinition<TMessage>, QueueBindingDefinition>;
}
