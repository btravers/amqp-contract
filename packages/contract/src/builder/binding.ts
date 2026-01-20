import type {
  DirectExchangeDefinition,
  ExchangeBindingDefinition,
  ExchangeDefinition,
  FanoutExchangeDefinition,
  QueueBindingDefinition,
  QueueDefinition,
  QueueEntry,
  QueueWithTtlBackoffInfrastructure,
  TopicExchangeDefinition,
} from "../types.js";

/**
 * Type guard to check if a queue entry is a QueueWithTtlBackoffInfrastructure.
 * Duplicated here to avoid circular dependency with queue.ts.
 * @internal
 */
function isQueueWithTtlBackoffInfrastructure(
  entry: QueueEntry,
): entry is QueueWithTtlBackoffInfrastructure {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "__brand" in entry &&
    entry.__brand === "QueueWithTtlBackoffInfrastructure"
  );
}

/**
 * Extract the plain QueueDefinition from a QueueEntry.
 * Duplicated here to avoid circular dependency with queue.ts.
 * @internal
 */
function extractQueueInternal(entry: QueueEntry): QueueDefinition {
  if (isQueueWithTtlBackoffInfrastructure(entry)) {
    return entry.queue;
  }
  return entry;
}

/**
 * Define a binding between a queue and a fanout exchange.
 *
 * Binds a queue to a fanout exchange to receive all messages published to the exchange.
 * Fanout exchanges ignore routing keys, so this overload doesn't require one.
 *
 * @param queue - The queue definition or queue with infrastructure to bind
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
  queue: QueueEntry,
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
 * @param queue - The queue definition or queue with infrastructure to bind
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
  queue: QueueEntry,
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
 * @param queue - The queue definition or queue with infrastructure to bind
 * @param exchange - The exchange definition
 * @param options - Optional binding configuration
 * @returns A queue binding definition
 * @internal
 */
export function defineQueueBinding(
  queue: QueueEntry,
  exchange: ExchangeDefinition,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): QueueBindingDefinition {
  // Extract the plain queue definition from QueueEntry
  const queueDef = extractQueueInternal(queue);

  if (exchange.type === "fanout") {
    return {
      type: "queue",
      queue: queueDef,
      exchange,
      ...(options?.arguments && { arguments: options.arguments }),
    } as QueueBindingDefinition;
  }

  return {
    type: "queue",
    queue: queueDef,
    exchange,
    routingKey: options?.routingKey,
    ...(options?.arguments && { arguments: options.arguments }),
  } as QueueBindingDefinition;
}

/**
 * Internal helper to call defineQueueBinding with proper type handling.
 * Used by queue.ts to avoid circular dependency.
 * @internal
 */
export function defineQueueBindingInternal(
  queue: QueueEntry,
  exchange: ExchangeDefinition,
  options?: {
    routingKey?: string;
    arguments?: Record<string, unknown>;
  },
): QueueBindingDefinition {
  if (exchange.type === "fanout") {
    return defineQueueBinding(queue, exchange, options);
  }
  return defineQueueBinding(queue, exchange, options as { routingKey: string });
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
