import type {
  BaseExchangeDefinition,
  DirectExchangeDefinition,
  ExchangeDefinition,
  FanoutExchangeDefinition,
  TopicExchangeDefinition,
} from "../types.js";

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
export function defineExchange<TName extends string>(
  name: TName,
  type: "fanout",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): FanoutExchangeDefinition<TName>;

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
export function defineExchange<TName extends string>(
  name: TName,
  type: "direct",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): DirectExchangeDefinition<TName>;

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
export function defineExchange<TName extends string>(
  name: TName,
  type: "topic",
  options?: Omit<BaseExchangeDefinition, "name" | "type">,
): TopicExchangeDefinition<TName>;

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
