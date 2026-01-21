import type {
  BindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  PublisherDefinition,
  QueueDefinition,
} from "../types.js";
import { definePublisherInternal } from "./publisher.js";
import { isCommandConsumerConfig } from "./command.js";
import { isEventPublisherConfig } from "./event.js";
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
  let result = { ...definition };
  let hasChanges = false;

  // Process queues to extract TTL-backoff infrastructure
  if (definition.queues && Object.keys(definition.queues).length > 0) {
    const expandedQueues: Record<string, QueueDefinition> = {};
    const queueBindings: Record<string, BindingDefinition> = {};

    for (const [name, entry] of Object.entries(definition.queues)) {
      if (isQueueWithTtlBackoffInfrastructure(entry)) {
        expandedQueues[name] = entry.queue;
        expandedQueues[`${name}Wait`] = entry.waitQueue;
        queueBindings[`${name}WaitBinding`] = entry.waitQueueBinding;
        queueBindings[`${name}RetryBinding`] = entry.mainQueueRetryBinding;
      } else {
        expandedQueues[name] = entry as QueueDefinition;
      }
    }

    result.queues = expandedQueues;
    hasChanges = true;

    if (Object.keys(queueBindings).length > 0) {
      result.bindings = { ...result.bindings, ...queueBindings };
    }
  }

  // Process events section - extract publishers
  if (definition.events && Object.keys(definition.events).length > 0) {
    const eventPublishers: Record<string, PublisherDefinition> = {};

    for (const [name, config] of Object.entries(definition.events)) {
      if (isEventPublisherConfig(config)) {
        // Create a publisher from the event config
        const publisherOptions: { routingKey?: string } = {};
        if (config.routingKey !== undefined) {
          publisherOptions.routingKey = config.routingKey;
        }
        eventPublishers[name] = definePublisherInternal(
          config.exchange,
          config.message,
          publisherOptions,
        );
      }
    }

    result.publishers = { ...result.publishers, ...eventPublishers };
    hasChanges = true;
  }

  // Process commands section - extract consumers and bindings
  if (definition.commands && Object.keys(definition.commands).length > 0) {
    const commandConsumers: Record<string, ConsumerDefinition> = {};
    const commandBindings: Record<string, BindingDefinition> = {};

    for (const [name, config] of Object.entries(definition.commands)) {
      if (isCommandConsumerConfig(config)) {
        commandConsumers[name] = config.consumer;
        commandBindings[`${name}Binding`] = config.binding;
      }
    }

    result.consumers = { ...result.consumers, ...commandConsumers };
    result.bindings = { ...result.bindings, ...commandBindings };
    hasChanges = true;
  }

  return hasChanges ? (result as TContract) : definition;
}
