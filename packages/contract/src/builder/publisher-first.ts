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
   * @param queue - The queue (or queue with infrastructure) that will consume the messages
   * @returns An object with the consumer definition and binding
   */
  createConsumer: (queue: QueueEntry) => {
    consumer: ConsumerDefinition<TMessage>;
    binding: QueueBindingDefinition;
  };
};

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
   * @param queue - The queue (or queue with infrastructure) that will consume the messages
   * @param routingKey - Optional routing key pattern for the binding (defaults to publisher's routing key)
   * @returns An object with the consumer definition and binding
   */
  createConsumer: <TConsumerRoutingKey extends string = TRoutingKey>(
    queue: QueueEntry,
    routingKey?: BindingPattern<TConsumerRoutingKey>,
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
 * const { publisher: publishLog, createConsumer: createLogConsumer } = definePublisherFirst(logsExchange, logMessage);
 *
 * // Multiple queues can consume the same event
 * const logsQueue1 = defineQueue('logs-queue-1', { durable: true });
 * const logsQueue2 = defineQueue('logs-queue-2', { durable: true });
 *
 * // Use in contract
 * const { consumer: consumer1, binding: binding1 } = createLogConsumer(logsQueue1);
 * const { consumer: consumer2, binding: binding2 } = createLogConsumer(logsQueue2);
 *
 * const contract = defineContract({
 *   exchanges: { logs: logsExchange },
 *   queues: { logsQueue1, logsQueue2 },
 *   bindings: {
 *     logBinding1: binding1,
 *     logBinding2: binding2,
 *   },
 *   publishers: { publishLog },
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
 * const { publisher: executeTaskPublisher, createConsumer: createTaskConsumer } = definePublisherFirst(
 *   tasksExchange,
 *   taskMessage,
 *   { routingKey: 'task.execute' }
 * );
 *
 * // Use in contract - routing key is consistent across publisher and bindings
 * const taskQueue = defineQueue('task-queue', { durable: true });
 * const { consumer, binding } = createTaskConsumer(taskQueue);
 *
 * const contract = defineContract({
 *   exchanges: { tasks: tasksExchange },
 *   queues: { taskQueue },
 *   bindings: { taskBinding: binding },
 *   publishers: { executeTask: executeTaskPublisher },
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
    routingKey: RoutingKey<TRoutingKey>;
    arguments?: Record<string, unknown>;
  },
): PublisherFirstResult<
  TMessage,
  Extract<
    PublisherDefinition<TMessage>,
    { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
  >
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
 * const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } = definePublisherFirst(
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
 *   createOrderCreatedConsumer(orderQueue);  // Uses 'order.created'
 * const { consumer: allOrdersConsumer, binding: allOrdersBinding } =
 *   createOrderCreatedConsumer(allOrdersQueue, 'order.*');  // Uses pattern
 *
 * const contract = defineContract({
 *   exchanges: { orders: ordersExchange },
 *   queues: { orderQueue, allOrdersQueue },
 *   bindings: {
 *     orderBinding: processBinding,
 *     allOrdersBinding,
 *   },
 *   publishers: { orderCreated: orderCreatedPublisher },
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
    routingKey: RoutingKey<TRoutingKey>;
    arguments?: Record<string, unknown>;
  },
): PublisherFirstResultWithRoutingKey<
  TMessage,
  Extract<
    PublisherDefinition<TMessage>,
    { exchange: DirectExchangeDefinition | TopicExchangeDefinition }
  >,
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
  const publisher = definePublisherInternal(exchange, message, options);

  // For topic exchanges, allow specifying routing key pattern when creating consumer
  if (exchange.type === "topic") {
    const createConsumer = (queue: QueueEntry, routingKey?: string) => {
      const bindingOptions = routingKey ? { ...options, routingKey } : options;
      const binding = defineQueueBindingInternal(queue, exchange, bindingOptions);
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
  const createConsumer = (queue: QueueEntry) => {
    const binding = defineQueueBindingInternal(queue, exchange, options);
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
