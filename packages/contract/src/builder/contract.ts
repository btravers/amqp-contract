import type { BindingDefinition, ContractDefinition, QueueDefinition } from "../types.js";
import { isQueueWithTtlBackoffInfrastructure } from "./queue.js";

/**
 * Define an AMQP contract.
 *
 * A contract is the central definition of your AMQP messaging topology. It brings together
 * all exchanges, queues, bindings, publishers, and consumers in a single, type-safe definition.
 *
 * The contract is used by both clients (for publishing) and workers (for consuming) to ensure
 * type safety throughout your messaging infrastructure. TypeScript will infer all message types
 * and publisher/consumer names from the contract.
 *
 * @param definition - The contract definition containing all AMQP resources
 * @param definition.exchanges - Named exchange definitions
 * @param definition.queues - Named queue definitions
 * @param definition.bindings - Named binding definitions (queue-to-exchange or exchange-to-exchange)
 * @param definition.publishers - Named publisher definitions for sending messages
 * @param definition.consumers - Named consumer definitions for receiving messages
 * @returns The same contract definition with full type inference
 *
 * @example
 * ```typescript
 * import {
 *   defineContract,
 *   defineExchange,
 *   defineQueue,
 *   defineQueueBinding,
 *   definePublisher,
 *   defineConsumer,
 *   defineMessage,
 * } from '@amqp-contract/contract';
 * import { z } from 'zod';
 *
 * // Define resources
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const orderQueue = defineQueue('order-processing', { durable: true });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   })
 * );
 *
 * // Compose contract
 * export const contract = defineContract({
 *   exchanges: {
 *     orders: ordersExchange,
 *   },
 *   queues: {
 *     orderProcessing: orderQueue,
 *   },
 *   bindings: {
 *     orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
 *       routingKey: 'order.created',
 *     }),
 *   },
 *   publishers: {
 *     orderCreated: definePublisher(ordersExchange, orderMessage, {
 *       routingKey: 'order.created',
 *     }),
 *   },
 *   consumers: {
 *     processOrder: defineConsumer(orderQueue, orderMessage),
 *   },
 * });
 *
 * // TypeScript now knows:
 * // - client.publish('orderCreated', { orderId: string, amount: number })
 * // - handler: async (message: { orderId: string, amount: number }) => void
 * ```
 */
export function defineContract<TContract extends ContractDefinition>(
  definition: TContract,
): TContract {
  // If no queues defined, return as-is (no processing needed)
  if (!definition.queues || Object.keys(definition.queues).length === 0) {
    return definition;
  }

  // Process queues to extract TTL-backoff infrastructure
  const queues = definition.queues;
  const expandedQueues: Record<string, QueueDefinition> = {};
  const autoBindings: Record<string, BindingDefinition> = {};

  for (const [name, entry] of Object.entries(queues)) {
    if (isQueueWithTtlBackoffInfrastructure(entry)) {
      // Extract the infrastructure
      expandedQueues[name] = entry.queue;
      expandedQueues[`${name}Wait`] = entry.waitQueue;
      autoBindings[`${name}WaitBinding`] = entry.waitQueueBinding;
      autoBindings[`${name}RetryBinding`] = entry.mainQueueRetryBinding;
    } else {
      expandedQueues[name] = entry as QueueDefinition;
    }
  }

  // Only add bindings if there are any auto-generated ones
  if (Object.keys(autoBindings).length > 0) {
    // Merge with existing bindings
    const mergedBindings = {
      ...definition.bindings,
      ...autoBindings,
    };

    return {
      ...definition,
      queues: expandedQueues,
      bindings: mergedBindings,
    } as TContract;
  }

  // Return with expanded queues only (no auto bindings)
  return {
    ...definition,
    queues: expandedQueues,
  } as TContract;
}
