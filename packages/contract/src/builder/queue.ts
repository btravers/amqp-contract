import type {
  ClassicQueueDefinition,
  ClassicQueueOptions,
  DeadLetterConfig,
  DefineQueueOptions,
  ExchangeDefinition,
  ExtractQueueFromEntry,
  QueueBindingDefinition,
  QueueDefinition,
  QueueEntry,
  QueueWithTtlBackoffInfrastructure,
  QuorumQueueDefinition,
  QuorumQueueOptions,
  ResolvedTtlBackoffRetryOptions,
  TtlBackoffRetryOptions,
} from "../types.js";
import { defineQueueBindingInternal } from "./binding.js";
import {
  isQueueWithTtlBackoffInfrastructure as isQueueWithTtlBackoffInfrastructureImpl,
  extractQueueFromEntry,
} from "./queue-utils.js";

/**
 * Resolve TTL-backoff retry options with defaults applied.
 * @internal
 */
export function resolveTtlBackoffOptions(
  options: TtlBackoffRetryOptions | undefined,
): ResolvedTtlBackoffRetryOptions {
  return {
    mode: "ttl-backoff",
    maxRetries: options?.maxRetries ?? 3,
    initialDelayMs: options?.initialDelayMs ?? 1000,
    maxDelayMs: options?.maxDelayMs ?? 30000,
    backoffMultiplier: options?.backoffMultiplier ?? 2,
    jitter: options?.jitter ?? true,
  };
}

/**
 * Type guard to check if a queue entry is a QueueWithTtlBackoffInfrastructure.
 *
 * When you configure a queue with TTL-backoff retry and a dead letter exchange,
 * `defineQueue` returns a `QueueWithTtlBackoffInfrastructure` instead of a plain
 * `QueueDefinition`. This type guard helps you distinguish between the two.
 *
 * **When to use:**
 * - When you need to check the type of a queue entry at runtime
 * - When writing generic code that handles both plain queues and infrastructure wrappers
 *
 * **Related functions:**
 * - `extractQueue()` - Use this to get the underlying queue definition from either type
 *
 * @param entry - The queue entry to check
 * @returns True if the entry is a QueueWithTtlBackoffInfrastructure, false otherwise
 *
 * @example
 * ```typescript
 * const queue = defineQueue('orders', {
 *   deadLetter: { exchange: dlx },
 *   retry: { mode: 'ttl-backoff' },
 * });
 *
 * if (isQueueWithTtlBackoffInfrastructure(queue)) {
 *   // queue has .queue, .waitQueue, .waitQueueBinding, .mainQueueRetryBinding
 *   console.log('Wait queue:', queue.waitQueue.name);
 * } else {
 *   // queue is a plain QueueDefinition
 *   console.log('Queue:', queue.name);
 * }
 * ```
 */
export function isQueueWithTtlBackoffInfrastructure(
  entry: QueueEntry,
): entry is QueueWithTtlBackoffInfrastructure {
  return isQueueWithTtlBackoffInfrastructureImpl(entry);
}

/**
 * Extract the plain QueueDefinition from a QueueEntry.
 *
 * **Why this function exists:**
 * When you configure a queue with TTL-backoff retry and a dead letter exchange,
 * `defineQueue` (or `defineTtlBackoffQueue`) returns a wrapper object that includes
 * the main queue, wait queue, and bindings. This function extracts the underlying
 * queue definition so you can access properties like `name`, `type`, etc.
 *
 * **When to use:**
 * - When you need to access queue properties (name, type, deadLetter, etc.)
 * - When passing a queue to functions that expect a plain QueueDefinition
 * - Works safely on both plain queues and infrastructure wrappers
 *
 * **How it works:**
 * - If the entry is a `QueueWithTtlBackoffInfrastructure`, returns `entry.queue`
 * - Otherwise, returns the entry as-is (it's already a plain QueueDefinition)
 *
 * @param entry - The queue entry (either plain QueueDefinition or QueueWithTtlBackoffInfrastructure)
 * @returns The plain QueueDefinition
 *
 * @example
 * ```typescript
 * import { defineQueue, defineTtlBackoffQueue, extractQueue } from '@amqp-contract/contract';
 *
 * // TTL-backoff queue returns a wrapper
 * const orderQueue = defineTtlBackoffQueue('orders', {
 *   deadLetter: { exchange: dlx },
 *   maxRetries: 3,
 * });
 *
 * // Use extractQueue to access the queue name
 * const queueName = extractQueue(orderQueue).name; // 'orders'
 *
 * // Also works safely on plain queues
 * const plainQueue = defineQueue('simple', { type: 'quorum', retry: { mode: 'quorum-native' } });
 * const plainName = extractQueue(plainQueue).name; // 'simple'
 *
 * // Access other properties
 * const queueDef = extractQueue(orderQueue);
 * console.log(queueDef.name);       // 'orders'
 * console.log(queueDef.type);       // 'quorum'
 * console.log(queueDef.deadLetter); // { exchange: dlx, ... }
 * ```
 *
 * @see isQueueWithTtlBackoffInfrastructure - Type guard to check if extraction is needed
 * @see defineTtlBackoffQueue - Creates queues with TTL-backoff infrastructure
 */
export function extractQueue<T extends QueueEntry>(entry: T): ExtractQueueFromEntry<T> {
  return extractQueueFromEntry(entry) as ExtractQueueFromEntry<T>;
}

/**
 * Create TTL-backoff retry infrastructure (wait queue + bindings) for a queue.
 * @internal
 */
export function createTtlBackoffInfrastructure(queue: QueueDefinition): {
  waitQueue: QuorumQueueDefinition;
  waitQueueBinding: QueueBindingDefinition;
  mainQueueRetryBinding: QueueBindingDefinition;
} {
  if (!queue.deadLetter) {
    throw new Error(
      `Queue "${queue.name}" does not have a dead letter exchange configured. ` +
        `TTL-backoff retry requires deadLetter to be set on the queue.`,
    );
  }

  const dlx = queue.deadLetter.exchange;
  const waitQueueName = `${queue.name}-wait`;

  // Create the wait queue - quorum for better durability
  // Wait queue uses TTL-backoff mode (infrastructure queue, not directly consumed)
  const waitQueue: QuorumQueueDefinition = {
    name: waitQueueName,
    type: "quorum",
    durable: queue.durable ?? true,
    deadLetter: {
      exchange: dlx,
      routingKey: queue.name, // Routes back to main queue after TTL
    },
    retry: resolveTtlBackoffOptions(undefined),
  };

  // Create binding for wait queue to receive failed messages
  const waitQueueBinding = defineQueueBindingInternal(waitQueue, dlx, {
    routingKey: waitQueueName,
  });

  // Create binding for main queue to receive retried messages
  const mainQueueRetryBinding = defineQueueBindingInternal(queue, dlx, {
    routingKey: queue.name,
  });

  return { waitQueue, waitQueueBinding, mainQueueRetryBinding };
}

/**
 * Wrap a queue definition with TTL-backoff retry infrastructure.
 * @internal
 */
function wrapWithTtlBackoffInfrastructure(
  queue: QueueDefinition,
): QueueWithTtlBackoffInfrastructure {
  const infra = createTtlBackoffInfrastructure(queue);

  return {
    __brand: "QueueWithTtlBackoffInfrastructure",
    queue,
    deadLetter: queue.deadLetter!,
    ...infra,
  };
}

/**
 * Define an AMQP queue.
 *
 * A queue stores messages until they are consumed by workers. Queues can be bound to exchanges
 * to receive messages based on routing rules.
 *
 * By default, queues are created as quorum queues which provide better durability and
 * high-availability. Use `type: 'classic'` for special cases like non-durable queues
 * or priority queues.
 *
 * @param name - The name of the queue
 * @param options - Optional queue configuration
 * @param options.type - Queue type: 'quorum' (default, recommended) or 'classic'
 * @param options.durable - If true, the queue survives broker restarts. Quorum queues are always durable.
 * @param options.exclusive - If true, the queue can only be used by the declaring connection. Only supported with classic queues.
 * @param options.autoDelete - If true, the queue is deleted when the last consumer unsubscribes (default: false)
 * @param options.deadLetter - Dead letter configuration for handling failed messages
 * @param options.maxPriority - Maximum priority level for priority queue (1-255, recommended: 1-10). Only supported with classic queues.
 * @param options.arguments - Additional AMQP arguments (e.g., x-message-ttl)
 * @returns A queue definition
 *
 * @example
 * ```typescript
 * // Quorum queue (default, recommended for production)
 * const orderQueue = defineQueue('order-processing');
 *
 * // Explicit quorum queue with dead letter exchange
 * const dlx = defineExchange('orders-dlx', 'topic', { durable: true });
 * const orderQueueWithDLX = defineQueue('order-processing', {
 *   type: 'quorum',
 *   deadLetter: {
 *     exchange: dlx,
 *     routingKey: 'order.failed'
 *   },
 *   arguments: {
 *     'x-message-ttl': 86400000, // 24 hours
 *   }
 * });
 *
 * // Classic queue (for special cases)
 * const tempQueue = defineQueue('temp-queue', {
 *   type: 'classic',
 *   durable: false,
 *   autoDelete: true,
 * });
 *
 * // Priority queue (requires classic type)
 * const taskQueue = defineQueue('urgent-tasks', {
 *   type: 'classic',
 *   durable: true,
 *   maxPriority: 10,
 * });
 *
 * // Queue with TTL-backoff retry (returns infrastructure automatically)
 * const dlx = defineExchange('orders-dlx', 'direct', { durable: true });
 * const orderQueue = defineQueue('order-processing', {
 *   deadLetter: { exchange: dlx },
 *   retry: { mode: 'ttl-backoff', maxRetries: 5 },
 * });
 * // orderQueue is QueueWithTtlBackoffInfrastructure, pass directly to defineContract
 * ```
 */
export function defineQueue<TName extends string, TDlx extends ExchangeDefinition>(
  name: TName,
  options: DefineQueueOptions & { deadLetter: { exchange: TDlx } },
): (QueueDefinition<TName> | QueueWithTtlBackoffInfrastructure<TName>) & {
  deadLetter: { exchange: TDlx };
};

export function defineQueue<TName extends string>(
  name: TName,
  options?: DefineQueueOptions,
): QueueDefinition<TName> | QueueWithTtlBackoffInfrastructure<TName>;

export function defineQueue(
  name: string,
  options?: DefineQueueOptions,
): QueueDefinition | QueueWithTtlBackoffInfrastructure {
  const opts = options ?? {};
  const type = opts.type ?? "quorum";

  // Build base properties shared by both queue types
  const baseProps: {
    name: string;
    durable?: boolean;
    autoDelete?: boolean;
    deadLetter?: DeadLetterConfig;
    arguments?: Record<string, unknown>;
  } = { name };

  if (opts.durable !== undefined) {
    baseProps.durable = opts.durable;
  }

  if (opts.autoDelete !== undefined) {
    baseProps.autoDelete = opts.autoDelete;
  }

  if (opts.deadLetter !== undefined) {
    baseProps.deadLetter = opts.deadLetter;
  }

  if (opts.arguments !== undefined) {
    baseProps.arguments = opts.arguments;
  }

  // Build quorum queue
  if (type === "quorum") {
    const quorumOpts = opts as QuorumQueueOptions;
    const inputRetry = quorumOpts.retry ?? { mode: "ttl-backoff" as const };

    // Validate quorum-native retry requirements
    if (inputRetry.mode === "quorum-native") {
      if (quorumOpts.deliveryLimit === undefined) {
        throw new Error(
          `Queue "${name}" uses quorum-native retry mode but deliveryLimit is not configured. ` +
            `Quorum-native retry requires deliveryLimit to be set.`,
        );
      }
    }

    // Resolve retry options: apply defaults for TTL-backoff, keep quorum-native as-is
    const retry =
      inputRetry.mode === "quorum-native" ? inputRetry : resolveTtlBackoffOptions(inputRetry);

    const queueDefinition: QuorumQueueDefinition = {
      ...baseProps,
      type: "quorum",
      retry,
    };

    // Validate and add deliveryLimit
    if (quorumOpts.deliveryLimit !== undefined) {
      if (quorumOpts.deliveryLimit < 1 || !Number.isInteger(quorumOpts.deliveryLimit)) {
        throw new Error(
          `Invalid deliveryLimit: ${quorumOpts.deliveryLimit}. Must be a positive integer.`,
        );
      }
      queueDefinition.deliveryLimit = quorumOpts.deliveryLimit;
    }

    // If TTL-backoff retry with dead letter exchange, wrap with infrastructure
    if (retry.mode === "ttl-backoff" && queueDefinition.deadLetter) {
      return wrapWithTtlBackoffInfrastructure(queueDefinition);
    }

    return queueDefinition;
  }

  // Build classic queue
  const classicOpts = opts as ClassicQueueOptions;

  // Classic queues cannot use quorum-native retry mode
  if ((classicOpts.retry as { mode?: string } | undefined)?.mode === "quorum-native") {
    throw new Error(
      `Queue "${name}" uses quorum-native retry mode but is a classic queue. ` +
        `Quorum-native retry requires quorum queues (type: "quorum").`,
    );
  }

  // Resolve TTL-backoff options with defaults
  const retry = resolveTtlBackoffOptions(classicOpts.retry);

  const queueDefinition: ClassicQueueDefinition = {
    ...baseProps,
    type: "classic",
    retry,
  };

  // Add exclusive
  if (classicOpts.exclusive !== undefined) {
    queueDefinition.exclusive = classicOpts.exclusive;
  }

  // Validate and add maxPriority argument
  if (classicOpts.maxPriority !== undefined) {
    if (classicOpts.maxPriority < 1 || classicOpts.maxPriority > 255) {
      throw new Error(
        `Invalid maxPriority: ${classicOpts.maxPriority}. Must be between 1 and 255. Recommended range: 1-10.`,
      );
    }
    queueDefinition.arguments = {
      ...queueDefinition.arguments,
      "x-max-priority": classicOpts.maxPriority,
    };
  }

  // If TTL-backoff retry with dead letter exchange, wrap with infrastructure
  if (retry.mode === "ttl-backoff" && queueDefinition.deadLetter) {
    return wrapWithTtlBackoffInfrastructure(queueDefinition);
  }

  return queueDefinition;
}

// =============================================================================
// Simplified Queue Configuration Helpers
// =============================================================================

/**
 * Options for creating a quorum queue with quorum-native retry.
 *
 * This simplified helper enforces the required configuration for quorum-native retry:
 * - Dead letter exchange is required (for failed messages)
 * - Delivery limit is required (for retry count)
 */
export type DefineQuorumQueueOptions = {
  /**
   * Dead letter configuration - required for retry support.
   * Failed messages will be sent to this exchange.
   */
  deadLetter: DeadLetterConfig;

  /**
   * Maximum number of delivery attempts before dead-lettering.
   * @minimum 1
   */
  deliveryLimit: number;

  /**
   * If true, the queue is deleted when the last consumer unsubscribes.
   * @default false
   */
  autoDelete?: boolean;

  /**
   * Additional AMQP arguments for advanced configuration.
   */
  arguments?: Record<string, unknown>;
};

/**
 * Create a quorum queue with quorum-native retry.
 *
 * This is a simplified helper that enforces best practices:
 * - Uses quorum queues (recommended for most use cases)
 * - Requires dead letter exchange for failed message handling
 * - Uses quorum-native retry mode (simpler than TTL-backoff)
 *
 * **When to use:**
 * - You want simple, immediate retries without exponential backoff
 * - You don't need configurable delays between retries
 * - You want the simplest retry configuration
 *
 * @param name - The queue name
 * @param options - Configuration options
 * @returns A quorum queue definition with quorum-native retry
 *
 * @example
 * ```typescript
 * const dlx = defineExchange('orders-dlx', 'direct', { durable: true });
 *
 * const orderQueue = defineQuorumQueue('order-processing', {
 *   deadLetter: { exchange: dlx },
 *   deliveryLimit: 3, // Retry up to 3 times
 * });
 *
 * // Use in a contract — exchanges, queues, and bindings are auto-extracted
 * const contract = defineContract({
 *   publishers: { ... },
 *   consumers: { processOrder: defineEventConsumer(event, orderQueue) },
 * });
 * ```
 *
 * @see defineQueue - For full queue configuration options
 * @see defineTtlBackoffQueue - For queues with exponential backoff retry
 */
export function defineQuorumQueue<TName extends string>(
  name: TName,
  options: DefineQuorumQueueOptions,
): QuorumQueueDefinition<TName> {
  const { deadLetter, deliveryLimit, autoDelete, arguments: args } = options;

  const queueOptions: QuorumQueueOptions = {
    type: "quorum",
    deadLetter,
    deliveryLimit,
    retry: { mode: "quorum-native" },
  };

  if (autoDelete !== undefined) queueOptions.autoDelete = autoDelete;
  if (args !== undefined) queueOptions.arguments = args;

  return defineQueue(name, queueOptions) as QuorumQueueDefinition<TName>;
}

/**
 * Options for creating a queue with TTL-backoff retry.
 *
 * This simplified helper enforces the required configuration for TTL-backoff retry:
 * - Dead letter exchange is required (used for retry routing)
 * - Returns infrastructure that includes wait queue and bindings
 */
export type DefineTtlBackoffQueueOptions = {
  /**
   * Dead letter configuration - required for TTL-backoff retry.
   * Used for routing messages to the wait queue and back.
   */
  deadLetter: DeadLetterConfig;

  /**
   * Maximum retry attempts before sending to DLQ.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in ms before first retry.
   * @default 1000
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in ms between retries.
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Exponential backoff multiplier.
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Add jitter to prevent thundering herd.
   * @default true
   */
  jitter?: boolean;

  /**
   * If true, the queue is deleted when the last consumer unsubscribes.
   * @default false
   */
  autoDelete?: boolean;

  /**
   * Additional AMQP arguments for advanced configuration.
   */
  arguments?: Record<string, unknown>;
};

/**
 * Create a queue with TTL-backoff retry (exponential backoff).
 *
 * This is a simplified helper that enforces best practices:
 * - Uses quorum queues (recommended for most use cases)
 * - Requires dead letter exchange for retry routing
 * - Uses TTL-backoff retry mode with configurable delays
 * - Automatically generates wait queue and bindings
 *
 * **When to use:**
 * - You need exponential backoff between retries
 * - You want configurable delays (initial delay, max delay, jitter)
 * - You're processing messages that may need time before retry
 *
 * **Returns:** A `QueueWithTtlBackoffInfrastructure` object that includes the
 * main queue, wait queue, and bindings. Pass this directly to `defineContract`
 * and it will be expanded automatically.
 *
 * @param name - The queue name
 * @param options - Configuration options
 * @returns A queue with TTL-backoff infrastructure
 *
 * @example
 * ```typescript
 * const dlx = defineExchange('orders-dlx', 'direct', { durable: true });
 *
 * const orderQueue = defineTtlBackoffQueue('order-processing', {
 *   deadLetter: { exchange: dlx },
 *   maxRetries: 5,
 *   initialDelayMs: 1000,  // Start with 1s delay
 *   maxDelayMs: 30000,     // Cap at 30s
 * });
 *
 * // Use in a contract — wait queue, bindings, and DLX are auto-extracted
 * const contract = defineContract({
 *   publishers: { ... },
 *   consumers: { processOrder: defineEventConsumer(event, extractQueue(orderQueue)) },
 * });
 *
 * // To access the underlying queue definition (e.g., for the queue name):
 * import { extractQueue } from '@amqp-contract/contract';
 * const queueName = extractQueue(orderQueue).name;
 * ```
 *
 * @see defineQueue - For full queue configuration options
 * @see defineQuorumQueue - For queues with quorum-native retry (simpler, immediate retries)
 * @see extractQueue - To access the underlying queue definition
 */
export function defineTtlBackoffQueue<TName extends string>(
  name: TName,
  options: DefineTtlBackoffQueueOptions,
): QueueWithTtlBackoffInfrastructure<TName> {
  const {
    deadLetter,
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    jitter,
    autoDelete,
    arguments: args,
  } = options;

  // Build retry options, only including defined values
  const retryOptions: TtlBackoffRetryOptions = { mode: "ttl-backoff" };
  if (maxRetries !== undefined) retryOptions.maxRetries = maxRetries;
  if (initialDelayMs !== undefined) retryOptions.initialDelayMs = initialDelayMs;
  if (maxDelayMs !== undefined) retryOptions.maxDelayMs = maxDelayMs;
  if (backoffMultiplier !== undefined) retryOptions.backoffMultiplier = backoffMultiplier;
  if (jitter !== undefined) retryOptions.jitter = jitter;

  const queueOptions: QuorumQueueOptions = {
    type: "quorum",
    deadLetter,
    retry: retryOptions,
  };

  if (autoDelete !== undefined) queueOptions.autoDelete = autoDelete;
  if (args !== undefined) queueOptions.arguments = args;

  const result = defineQueue(name, queueOptions);

  // Since we configured TTL-backoff with a dead letter exchange, the result will
  // always be QueueWithTtlBackoffInfrastructure
  return result as QueueWithTtlBackoffInfrastructure<TName>;
}
