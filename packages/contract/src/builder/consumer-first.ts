import type { BindingPattern, RoutingKey } from "./routing-types.js";
import type {
  ConsumerDefinition,
  DirectExchangeDefinition,
  ExchangeDefinition,
  FanoutExchangeDefinition,
  MessageDefinition,
  PublisherDefinition,
  QueueBindingDefinition,
  QueueEntry,
  TopicExchangeDefinition,
} from "../types.js";
import { defineConsumer } from "./consumer.js";
import { definePublisherInternal } from "./publisher.js";
import { defineQueueBindingInternal } from "./binding.js";

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

/**
 * Consumer-first builder result for topic exchanges.
 *
 * This type represents a consumer with its binding (which may use a pattern) and provides
 * a method to create a publisher with a concrete routing key that matches the pattern.
 *
 * @template TMessage - The message definition
 * @template TConsumer - The consumer definition
 * @template TBinding - The queue binding definition
 */
export type ConsumerFirstResultWithRoutingKey<
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
   * For topic exchanges, the routing key can be specified to match the binding pattern.
   *
   * @param routingKey - The concrete routing key that matches the binding pattern
   * @returns A publisher definition with the specified routing key
   */
  createPublisher: <TPublisherRoutingKey extends string>(
    routingKey: RoutingKey<TPublisherRoutingKey>,
  ) => Extract<
    PublisherDefinition<TMessage>,
    { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
  >;
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
 * const { consumer: processNotificationConsumer, binding: notificationBinding, createPublisher: createNotificationPublisher } = defineConsumerFirst(
 *   notificationsQueue,
 *   notificationsExchange,
 *   notificationMessage
 * );
 *
 * // Use in contract
 * const contract = defineContract({
 *   exchanges: { notifications: notificationsExchange },
 *   queues: { notificationsQueue },
 *   bindings: { notificationBinding },
 *   publishers: { sendNotification: createNotificationPublisher() },
 *   consumers: { processNotification: processNotificationConsumer },
 * });
 * ```
 */
export function defineConsumerFirst<TMessage extends MessageDefinition>(
  queue: QueueEntry,
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
 * const { consumer: processTaskConsumer, binding: taskBinding, createPublisher: createTaskPublisher } = defineConsumerFirst(
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
 *   bindings: { taskBinding },
 *   publishers: { executeTask: createTaskPublisher() },
 *   consumers: { processTask: processTaskConsumer },
 * });
 * ```
 */
export function defineConsumerFirst<TMessage extends MessageDefinition, TRoutingKey extends string>(
  queue: QueueEntry,
  exchange: DirectExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: RoutingKey<TRoutingKey>;
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
 * const { consumer: processOrderConsumer, binding: orderBinding, createPublisher: createOrderPublisher } = defineConsumerFirst(
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
 *   bindings: { orderBinding },
 *   publishers: {
 *     orderCreated: createOrderPublisher('order.created'),  // Concrete key
 *     orderUpdated: createOrderPublisher('order.updated'),  // Concrete key
 *   },
 *   consumers: { processOrder: processOrderConsumer },
 * });
 * ```
 */
export function defineConsumerFirst<TMessage extends MessageDefinition, TRoutingKey extends string>(
  queue: QueueEntry,
  exchange: TopicExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: BindingPattern<TRoutingKey>;
    arguments?: Record<string, unknown>;
  },
): ConsumerFirstResultWithRoutingKey<
  TMessage,
  ConsumerDefinition<TMessage>,
  Extract<QueueBindingDefinition, { exchange: TopicExchangeDefinition }>
>;

/**
 * Implementation of defineConsumerFirst.
 * @internal
 */
export function defineConsumerFirst<TMessage extends MessageDefinition>(
  queue: QueueEntry,
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
      QueueBindingDefinition
    > {
  // Create the consumer
  const consumer = defineConsumer(queue, message);

  // Create the binding
  const binding = defineQueueBindingInternal(queue, exchange, options);

  // For topic exchanges, allow specifying routing key when creating publisher
  if (exchange.type === "topic") {
    const createPublisher = (
      routingKey: string,
    ): Extract<
      PublisherDefinition<TMessage>,
      { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
    > => {
      return definePublisherInternal(exchange, message, { ...options, routingKey }) as Extract<
        PublisherDefinition<TMessage>,
        { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
      >;
    };

    return {
      consumer,
      binding,
      createPublisher,
    } as ConsumerFirstResultWithRoutingKey<
      TMessage,
      ConsumerDefinition<TMessage>,
      QueueBindingDefinition
    >;
  }

  // For fanout and direct exchanges, use the same routing key from binding
  const createPublisher = () => {
    return definePublisherInternal(exchange, message, options);
  };

  return {
    consumer,
    binding,
    createPublisher,
  } as ConsumerFirstResult<TMessage, ConsumerDefinition<TMessage>, QueueBindingDefinition>;
}
