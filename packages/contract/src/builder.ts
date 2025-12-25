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
 * Publisher-first builder result.
 *
 * This type represents a publisher with its binding and provides a method to create
 * a consumer that uses the same message schema and is connected via the binding.
 *
 * @template TMessage - The message definition
 * @template TPublisher - The publisher definition
 * @template TBinding - The queue binding definition
 */
export type PublisherFirstResult<
  TMessage extends MessageDefinition,
  TPublisher extends PublisherDefinition<TMessage>,
  TBinding extends QueueBindingDefinition,
> = {
  /** The publisher definition */
  publisher: TPublisher;
  /** The binding definition connecting the exchange to the queue */
  binding: TBinding;
  /**
   * Create a consumer that receives messages from this publisher.
   * The consumer will automatically use the same message schema.
   *
   * @returns A consumer definition with the same message type
   */
  createConsumer: () => ConsumerDefinition<TMessage>;
};

/**
 * Define a publisher-first relationship between a publisher and consumer.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the publisher and consumer use the same message schema
 * 2. Linking the routing key from the publisher to the binding
 * 3. Creating a binding that connects the exchange to the queue
 *
 * Use this when you want to start with a publisher and ensure consumers
 * receive the same message type.
 *
 * @param exchange - The exchange to publish to (fanout type)
 * @param queue - The queue that will receive the messages
 * @param message - The message definition (schema and metadata)
 * @param options - Optional binding configuration
 * @returns A publisher-first result with publisher, binding, and consumer factory
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const logsExchange = defineExchange('logs', 'fanout', { durable: true });
 * const logsQueue = defineQueue('logs-queue', { durable: true });
 * const logMessage = defineMessage(
 *   z.object({
 *     level: z.enum(['info', 'warn', 'error']),
 *     message: z.string(),
 *   })
 * );
 *
 * // Create publisher-first relationship
 * const logPublisherFirst = definePublisherFirst(logsExchange, logsQueue, logMessage);
 *
 * // Use in contract
 * const contract = defineContract({
 *   exchanges: { logs: logsExchange },
 *   queues: { logsQueue },
 *   bindings: { logBinding: logPublisherFirst.binding },
 *   publishers: { publishLog: logPublisherFirst.publisher },
 *   consumers: { consumeLog: logPublisherFirst.createConsumer() },
 * });
 * ```
 */
export function definePublisherFirst<TMessage extends MessageDefinition>(
  exchange: FanoutExchangeDefinition,
  queue: QueueDefinition,
  message: TMessage,
  options?: Omit<
    Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>,
    "type" | "queue" | "exchange" | "routingKey"
  >,
): PublisherFirstResult<
  TMessage,
  Extract<PublisherDefinition<TMessage>, { exchange: FanoutExchangeDefinition }>,
  Extract<QueueBindingDefinition, { exchange: FanoutExchangeDefinition }>
>;

/**
 * Define a publisher-first relationship between a publisher and consumer.
 *
 * This builder enforces consistency by:
 * 1. Ensuring the publisher and consumer use the same message schema
 * 2. Linking the routing key from the publisher to the binding
 * 3. Creating a binding that connects the exchange to the queue
 *
 * Use this when you want to start with a publisher and ensure consumers
 * receive the same message type with the same routing key.
 *
 * @param exchange - The exchange to publish to (direct or topic type)
 * @param queue - The queue that will receive the messages
 * @param message - The message definition (schema and metadata)
 * @param options - Binding configuration (routingKey is required)
 * @param options.routingKey - The routing key for message routing
 * @returns A publisher-first result with publisher, binding, and consumer factory
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 *
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   })
 * );
 *
 * // Create publisher-first relationship with routing key
 * const orderPublisherFirst = definePublisherFirst(
 *   ordersExchange,
 *   orderQueue,
 *   orderMessage,
 *   { routingKey: 'order.created' }
 * );
 *
 * // Use in contract - routing key is consistent across publisher and binding
 * const contract = defineContract({
 *   exchanges: { orders: ordersExchange },
 *   queues: { orderQueue },
 *   bindings: { orderBinding: orderPublisherFirst.binding },
 *   publishers: { orderCreated: orderPublisherFirst.publisher },
 *   consumers: { processOrder: orderPublisherFirst.createConsumer() },
 * });
 * ```
 */
export function definePublisherFirst<TMessage extends MessageDefinition>(
  exchange: DirectExchangeDefinition | TopicExchangeDefinition,
  queue: QueueDefinition,
  message: TMessage,
  options: Omit<
    Extract<
      QueueBindingDefinition,
      { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
    >,
    "type" | "queue" | "exchange"
  >,
): PublisherFirstResult<
  TMessage,
  Extract<
    PublisherDefinition<TMessage>,
    { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
  >,
  Extract<QueueBindingDefinition, { exchange: DirectExchangeDefinition | TopicExchangeDefinition }>
>;

/**
 * Implementation of definePublisherFirst.
 * @internal
 */
export function definePublisherFirst<TMessage extends MessageDefinition>(
  exchange: ExchangeDefinition,
  queue: QueueDefinition,
  message: TMessage,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): PublisherFirstResult<TMessage, PublisherDefinition<TMessage>, QueueBindingDefinition> {
  // Create the binding based on exchange type
  let binding: QueueBindingDefinition;
  if (exchange.type === "fanout") {
    binding = defineQueueBinding(queue, exchange, options);
  } else {
    binding = defineQueueBinding(queue, exchange, options as { routingKey: string });
  }

  // Create the publisher with the same routing key based on exchange type
  let publisher: PublisherDefinition<TMessage>;
  if (exchange.type === "fanout") {
    publisher = definePublisher(exchange, message, options);
  } else {
    publisher = definePublisher(exchange, message, options as { routingKey: string });
  }

  // Factory function to create a consumer with the same message type
  const createConsumer = (): ConsumerDefinition<TMessage> => {
    return defineConsumer(queue, message);
  };

  return {
    publisher,
    binding,
    createConsumer,
  };
}

/**
 * Consumer-first builder result.
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
  createPublisher: () => PublisherDefinition<TMessage>;
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
 * @param exchange - The exchange that routes to the queue (direct or topic type)
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
export function defineConsumerFirst<TMessage extends MessageDefinition>(
  queue: QueueDefinition,
  exchange: DirectExchangeDefinition | TopicExchangeDefinition,
  message: TMessage,
  options: Omit<
    Extract<
      QueueBindingDefinition,
      { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
    >,
    "type" | "queue" | "exchange"
  >,
): ConsumerFirstResult<
  TMessage,
  ConsumerDefinition<TMessage>,
  Extract<QueueBindingDefinition, { exchange: DirectExchangeDefinition | TopicExchangeDefinition }>
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
): ConsumerFirstResult<TMessage, ConsumerDefinition<TMessage>, QueueBindingDefinition> {
  // Create the consumer
  const consumer = defineConsumer(queue, message);

  // Create the binding based on exchange type
  let binding: QueueBindingDefinition;
  if (exchange.type === "fanout") {
    binding = defineQueueBinding(queue, exchange, options);
  } else {
    binding = defineQueueBinding(queue, exchange, options as { routingKey: string });
  }

  // Factory function to create a publisher with the same message type and routing key
  const createPublisher = (): PublisherDefinition<TMessage> => {
    if (exchange.type === "fanout") {
      return definePublisher(exchange, message, options);
    }
    return definePublisher(exchange, message, options as { routingKey: string });
  };

  return {
    consumer,
    binding,
    createPublisher,
  };
}
