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
 * Configuration for a command consumer.
 *
 * Commands are sent by one or more publishers to a single consumer (task queue pattern).
 * The consumer "owns" the queue, and publishers send commands to it.
 *
 * @template TMessage - The message definition
 * @template TExchange - The exchange definition
 * @template TRoutingKey - The routing key type (undefined for fanout)
 */
export type CommandConsumerConfig<
  TMessage extends MessageDefinition,
  TExchange extends ExchangeDefinition,
  TRoutingKey extends string | undefined = undefined,
> = {
  /** Discriminator to identify this as a command consumer config */
  __brand: "CommandConsumerConfig";
  /** The consumer definition for processing commands */
  consumer: ConsumerDefinition<TMessage>;
  /** The binding connecting the queue to the exchange */
  binding: QueueBindingDefinition;
  /** The exchange that receives commands */
  exchange: TExchange;
  /** The message definition */
  message: TMessage;
  /** The routing key pattern for the binding */
  routingKey: TRoutingKey;
};

/**
 * Define a command consumer for receiving commands via fanout exchange.
 *
 * Commands are sent by publishers to a specific queue. The consumer "owns" the
 * queue and defines what commands it accepts.
 *
 * @param queue - The queue that will receive commands
 * @param exchange - The fanout exchange that routes commands
 * @param message - The message definition (schema and metadata)
 * @returns A command consumer configuration
 *
 * @example
 * ```typescript
 * const tasksExchange = defineExchange('tasks', 'fanout', { durable: true });
 * const taskMessage = defineMessage(z.object({ taskId: z.string() }));
 *
 * // Consumer owns the queue
 * const executeTask = defineCommandConsumer(taskQueue, tasksExchange, taskMessage);
 *
 * // Publishers send commands to it
 * const sendTask = defineCommandPublisher(executeTask);
 * ```
 */
export function defineCommandConsumer<TMessage extends MessageDefinition>(
  queue: QueueEntry,
  exchange: FanoutExchangeDefinition,
  message: TMessage,
): CommandConsumerConfig<TMessage, FanoutExchangeDefinition, undefined>;

/**
 * Define a command consumer for receiving commands via direct exchange.
 *
 * Commands are sent by publishers with a specific routing key that matches
 * the binding pattern.
 *
 * @param queue - The queue that will receive commands
 * @param exchange - The direct exchange that routes commands
 * @param message - The message definition (schema and metadata)
 * @param options - Configuration with required routing key
 * @param options.routingKey - The routing key for the binding
 * @param options.arguments - Additional AMQP arguments
 * @returns A command consumer configuration
 *
 * @example
 * ```typescript
 * const tasksExchange = defineExchange('tasks', 'direct', { durable: true });
 * const taskMessage = defineMessage(z.object({ taskId: z.string() }));
 *
 * const executeTask = defineCommandConsumer(taskQueue, tasksExchange, taskMessage, {
 *   routingKey: 'task.execute',
 * });
 *
 * const sendTask = defineCommandPublisher(executeTask);
 * ```
 */
export function defineCommandConsumer<
  TMessage extends MessageDefinition,
  TRoutingKey extends string,
>(
  queue: QueueEntry,
  exchange: DirectExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: RoutingKey<TRoutingKey>;
    arguments?: Record<string, unknown>;
  },
): CommandConsumerConfig<TMessage, DirectExchangeDefinition, TRoutingKey>;

/**
 * Define a command consumer for receiving commands via topic exchange.
 *
 * The consumer binds with a routing key pattern (can use * and # wildcards).
 * Publishers then send commands with concrete routing keys that match the pattern.
 *
 * @param queue - The queue that will receive commands
 * @param exchange - The topic exchange that routes commands
 * @param message - The message definition (schema and metadata)
 * @param options - Configuration with required routing key pattern
 * @param options.routingKey - The routing key pattern for the binding
 * @param options.arguments - Additional AMQP arguments
 * @returns A command consumer configuration
 *
 * @example
 * ```typescript
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderMessage = defineMessage(z.object({ orderId: z.string() }));
 *
 * // Consumer uses pattern to receive multiple command types
 * const processOrder = defineCommandConsumer(orderQueue, ordersExchange, orderMessage, {
 *   routingKey: 'order.*',
 * });
 *
 * // Publishers send with concrete keys
 * const createOrder = defineCommandPublisher(processOrder, {
 *   routingKey: 'order.create',
 * });
 * const updateOrder = defineCommandPublisher(processOrder, {
 *   routingKey: 'order.update',
 * });
 * ```
 */
export function defineCommandConsumer<
  TMessage extends MessageDefinition,
  TRoutingKey extends string,
>(
  queue: QueueEntry,
  exchange: TopicExchangeDefinition,
  message: TMessage,
  options: {
    routingKey: BindingPattern<TRoutingKey>;
    arguments?: Record<string, unknown>;
  },
): CommandConsumerConfig<TMessage, TopicExchangeDefinition, TRoutingKey>;

/**
 * Implementation of defineCommandConsumer.
 * @internal
 */
export function defineCommandConsumer<TMessage extends MessageDefinition>(
  queue: QueueEntry,
  exchange: ExchangeDefinition,
  message: TMessage,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): CommandConsumerConfig<TMessage, ExchangeDefinition, string | undefined> {
  const consumer = defineConsumer(queue, message);
  const binding = defineQueueBindingInternal(queue, exchange, options);

  return {
    __brand: "CommandConsumerConfig",
    consumer,
    binding,
    exchange,
    message,
    routingKey: options?.routingKey,
  };
}

/**
 * Create a publisher that sends commands to a fanout exchange consumer.
 *
 * @param commandConsumer - The command consumer configuration
 * @returns A publisher definition
 *
 * @example
 * ```typescript
 * const executeTask = defineCommandConsumer(taskQueue, fanoutExchange, taskMessage);
 * const sendTask = defineCommandPublisher(executeTask);
 * ```
 */
export function defineCommandPublisher<TMessage extends MessageDefinition>(
  commandConsumer: CommandConsumerConfig<TMessage, FanoutExchangeDefinition, undefined>,
): { message: TMessage; exchange: FanoutExchangeDefinition };

/**
 * Create a publisher that sends commands to a direct exchange consumer.
 *
 * @param commandConsumer - The command consumer configuration
 * @returns A publisher definition
 */
export function defineCommandPublisher<
  TMessage extends MessageDefinition,
  TRoutingKey extends string,
>(
  commandConsumer: CommandConsumerConfig<TMessage, DirectExchangeDefinition, TRoutingKey>,
): { message: TMessage; exchange: DirectExchangeDefinition; routingKey: string };

/**
 * Create a publisher that sends commands to a topic exchange consumer.
 *
 * For topic exchanges where the consumer uses a pattern, the publisher can
 * optionally specify a concrete routing key that matches the pattern.
 *
 * @param commandConsumer - The command consumer configuration
 * @param options - Optional publisher configuration
 * @param options.routingKey - Override routing key (must match consumer's pattern)
 * @returns A publisher definition
 *
 * @example
 * ```typescript
 * // Consumer binds with pattern
 * const processOrder = defineCommandConsumer(orderQueue, topicExchange, orderMessage, {
 *   routingKey: 'order.*',
 * });
 *
 * // Publisher uses concrete key matching the pattern
 * const createOrder = defineCommandPublisher(processOrder, {
 *   routingKey: 'order.create',
 * });
 * ```
 */
export function defineCommandPublisher<
  TMessage extends MessageDefinition,
  TRoutingKey extends string,
  TPublisherRoutingKey extends string = TRoutingKey,
>(
  commandConsumer: CommandConsumerConfig<TMessage, TopicExchangeDefinition, TRoutingKey>,
  options?: {
    routingKey?: RoutingKey<TPublisherRoutingKey>;
  },
): { message: TMessage; exchange: TopicExchangeDefinition; routingKey: string };

/**
 * Implementation of defineCommandPublisher.
 * @internal
 */
export function defineCommandPublisher<TMessage extends MessageDefinition>(
  commandConsumer: CommandConsumerConfig<TMessage, ExchangeDefinition, string | undefined>,
  options?: {
    routingKey?: string;
  },
): PublisherDefinition<TMessage> {
  const { exchange, message, routingKey: consumerRoutingKey } = commandConsumer;

  // For topic exchanges, publisher can override the routing key
  const publisherRoutingKey = options?.routingKey ?? consumerRoutingKey;

  const publisherOptions: { routingKey?: string } = {};
  if (publisherRoutingKey !== undefined) {
    publisherOptions.routingKey = publisherRoutingKey;
  }

  return definePublisherInternal(exchange, message, publisherOptions);
}

/**
 * Type guard to check if a value is a CommandConsumerConfig.
 *
 * @param value - The value to check
 * @returns True if the value is a CommandConsumerConfig
 */
export function isCommandConsumerConfig(
  value: unknown,
): value is CommandConsumerConfig<MessageDefinition, ExchangeDefinition, string | undefined> {
  return (
    typeof value === "object" &&
    value !== null &&
    "__brand" in value &&
    value.__brand === "CommandConsumerConfig"
  );
}
