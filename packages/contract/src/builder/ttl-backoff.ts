import type { QueueBindingDefinition, QueueDefinition, QueueEntry } from "../types.js";
import { createTtlBackoffInfrastructure, extractQueue } from "./queue.js";

/**
 * Result type for TTL-backoff retry infrastructure builder.
 *
 * Contains the wait queue and bindings needed for TTL-backoff retry.
 */
export type TtlBackoffRetryInfrastructure = {
  /**
   * The wait queue for holding messages during backoff delay.
   * This is a classic queue with a dead letter exchange pointing back to the main queue.
   */
  waitQueue: QueueDefinition;
  /**
   * Binding that routes failed messages to the wait queue.
   */
  waitQueueBinding: QueueBindingDefinition;
  /**
   * Binding that routes retried messages back to the main queue.
   */
  mainQueueRetryBinding: QueueBindingDefinition;
};

/**
 * Create TTL-backoff retry infrastructure for a queue.
 *
 * This builder helper generates the wait queue and bindings needed for TTL-backoff retry.
 * The generated infrastructure can be spread into a contract definition.
 *
 * TTL-backoff retry works by:
 * 1. Failed messages are sent to the DLX with routing key `{queueName}-wait`
 * 2. The wait queue receives these messages and holds them for a TTL period
 * 3. After TTL expires, messages are dead-lettered back to the DLX with routing key `{queueName}`
 * 4. The main queue receives the retried message via its binding to the DLX
 *
 * @param queue - The main queue definition (must have deadLetter configured)
 * @param options - Optional configuration for the wait queue
 * @param options.waitQueueDurable - Whether the wait queue should be durable (default: same as main queue)
 * @returns TTL-backoff retry infrastructure containing wait queue and bindings
 * @throws {Error} If the queue does not have a dead letter exchange configured
 *
 * @example
 * ```typescript
 * const dlx = defineExchange('orders-dlx', 'direct', { durable: true });
 * const orderQueue = defineQueue('order-processing', {
 *   type: 'quorum',
 *   deadLetter: { exchange: dlx },
 *   retry: {
 *     mode: 'ttl-backoff',
 *     maxRetries: 5,
 *     initialDelayMs: 1000,
 *   },
 * });
 *
 * // Infrastructure is auto-extracted when using defineContract:
 * const contract = defineContract({
 *   publishers: { ... },
 *   consumers: { processOrder: defineEventConsumer(event, extractQueue(orderQueue)) },
 * });
 * // contract.queues includes the wait queue, contract.bindings includes retry bindings
 *
 * // Or generate manually for advanced use cases:
 * const retryInfra = defineTtlBackoffRetryInfrastructure(orderQueue);
 * ```
 */
export function defineTtlBackoffRetryInfrastructure(
  queueEntry: QueueEntry,
  options?: {
    waitQueueDurable?: boolean;
  },
): TtlBackoffRetryInfrastructure {
  const queue = extractQueue(queueEntry);
  const infra = createTtlBackoffInfrastructure(queue);

  // Apply waitQueueDurable override if specified
  if (options?.waitQueueDurable !== undefined) {
    infra.waitQueue.durable = options.waitQueueDurable;
  }

  return infra;
}
