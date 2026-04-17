import type {
  HeadersExchangeDefinition,
  QueueBindingDefinition,
  QueueDefinition,
  QueueEntry,
} from "../types.js";
import { extractQueueFromEntry } from "./queue-utils.js";
import { createTtlBackoffInfrastructure } from "./queue.js";

/**
 * Result type for TTL-backoff retry infrastructure builder.
 *
 * Contains the wait queue and bindings needed for TTL-backoff retry.
 */
export type TtlBackoffRetryInfrastructure = {
  /**
   * The wait queue for holding messages during backoff delay.
   */
  waitQueue: QueueDefinition;
  /**
   * Binding that routes failed messages to the wait queue.
   */
  waitQueueBinding: QueueBindingDefinition;
  /**
   * Binding that routes retried messages back to the main queue.
   */
  retryQueueBinding: QueueBindingDefinition;
  /**
   * The wait exchange used to route messages to the wait queue.
   * This is an headers exchange, allowing to use headers for routing, while preserving original message routing key.
   * Bindings to this exchange will use a `x-wait-queue` header to specify the wait queue to which messages should be routed.
   */
  waitExchange: HeadersExchangeDefinition;
  /**
   * The retry exchange used to route messages back to the main queue.
   * This is an headers exchange, allowing to use headers for routing, while preserving original message routing key.
   * Bindings to this exchange will use a `x-retry-queue` header to specify the retry queue to which messages should be routed.
   */
  retryExchange: HeadersExchangeDefinition;
};

/**
 * Create TTL-backoff retry infrastructure for a queue.
 *
 * This builder helper generates the wait queue and bindings needed for TTL-backoff retry.
 * The generated infrastructure can be spread into a contract definition.
 *
 * TTL-backoff retry works by:
 * 1. Failed messages are sent to the wait exchange with header `x-wait-queue` set to the wait queue name
 * 2. The wait queue receives these messages and holds them for a TTL period
 * 3. After TTL expires, messages are dead-lettered back to the retry exchange with header `x-retry-queue` set to the main queue name
 * 4. The main queue receives the retried message via its binding to the retry exchange
 *
 * @param queue - The main queue definition
 * @param options - Optional configuration for the wait queue
 * @returns TTL-backoff retry infrastructure containing wait queue and bindings
 * @throws {Error} If the queue does not have retry mode set to `ttl-backoff`
 *
 * @example
 * ```typescript
 * const orderQueue = defineQueue('order-processing', {
 *   type: 'quorum',
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
 *   consumers: { processOrder: defineEventConsumer(event, orderQueue) },
 * });
 * // contract.queues includes the wait queue, contract.bindings includes retry bindings
 *
 * // Or generate manually for advanced use cases:
 * const retryInfra = defineTtlBackoffRetryInfrastructure(orderQueue);
 * ```
 */
export function defineTtlBackoffRetryInfrastructure(
  queueEntry: QueueEntry,
): TtlBackoffRetryInfrastructure {
  const queue = extractQueueFromEntry(queueEntry);
  const infra = createTtlBackoffInfrastructure(queue);

  return infra;
}
