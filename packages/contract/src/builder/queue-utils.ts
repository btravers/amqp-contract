import type { ExtractQueueFromEntry, QueueDefinition, QueueEntry } from "../types.js";
import { isQueueWithTtlBackoffInfrastructure } from "./ttl-backoff.js";

/**
 * Extract the plain QueueDefinition from a QueueEntry.
 * @internal
 */
function extractQueueFromEntry(entry: QueueEntry): QueueDefinition {
  if (isQueueWithTtlBackoffInfrastructure(entry)) {
    return entry.queue;
  }
  return entry;
}

/**
 * Extract the plain QueueDefinition from a QueueEntry.
 *
 * **Why this function exists:**
 * When you configure a queue with TTL-backoff retry,
 * `defineQueue` returns a wrapper object that includes
 * the main queue, wait queue, headers exchanges, and bindings. This function extracts the underlying
 * queue definition so you can access properties like `name`, `type`, etc.
 *
 * **When to use:**
 * - When you need to access queue properties (name, type, etc.)
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
 * import { defineQueue, extractQueue } from '@amqp-contract/contract';
 *
 * // TTL-backoff queue returns a wrapper
 * const orderQueue = defineQueue('orders', {
 *   retry: { mode: 'ttl-backoff', maxRetries: 3 },
 * });
 *
 * // Use extractQueue to access the queue name
 * const queueName = extractQueue(orderQueue).name; // 'orders'
 *
 * // Also works safely on plain queues
 * const plainQueue = defineQueue('simple', { type: 'quorum', retry: { mode: 'immediate-requeue' } });
 * const plainName = extractQueue(plainQueue).name; // 'simple'
 *
 * // Access other properties
 * const queueDef = extractQueue(orderQueue);
 * console.log(queueDef.name);       // 'orders'
 * console.log(queueDef.type);       // 'quorum'
 * ```
 *
 * @see isQueueWithTtlBackoffInfrastructure - Type guard to check if extraction is needed
 */
export function extractQueue<T extends QueueEntry>(entry: T): ExtractQueueFromEntry<T> {
  return extractQueueFromEntry(entry) as ExtractQueueFromEntry<T>;
}
