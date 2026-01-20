import type {
  ClassicQueueDefinition,
  ClassicQueueOptions,
  DeadLetterConfig,
  DefineQueueOptions,
  QueueDefinition,
  QueueEntry,
  QueueWithTtlBackoffInfrastructure,
  QuorumQueueDefinition,
  QuorumQueueOptions,
  ResolvedTtlBackoffRetryOptions,
  TtlBackoffRetryOptions,
} from "../types.js";
import { defineQueueBindingInternal } from "./binding.js";

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
 * @internal
 */
export function isQueueWithTtlBackoffInfrastructure(
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
 * If the entry is a QueueWithTtlBackoffInfrastructure, returns the inner queue.
 * Otherwise, returns the entry as-is.
 *
 * @param entry - The queue entry (either plain QueueDefinition or QueueWithTtlBackoffInfrastructure)
 * @returns The plain QueueDefinition
 *
 * @example
 * ```typescript
 * const queue = defineQueue('orders', { retry: { mode: 'ttl-backoff' }, deadLetter: { exchange: dlx } });
 * const plainQueue = extractQueue(queue); // Returns the inner QueueDefinition
 * ```
 */
export function extractQueue(entry: QueueEntry): QueueDefinition {
  if (isQueueWithTtlBackoffInfrastructure(entry)) {
    return entry.queue;
  }
  return entry;
}

/**
 * Wrap a queue definition with TTL-backoff retry infrastructure.
 * @internal
 */
function wrapWithTtlBackoffInfrastructure(
  queue: QueueDefinition,
): QueueWithTtlBackoffInfrastructure {
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

  return {
    __brand: "QueueWithTtlBackoffInfrastructure",
    queue,
    waitQueue,
    waitQueueBinding,
    mainQueueRetryBinding,
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
