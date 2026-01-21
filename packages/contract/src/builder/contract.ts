import type {
  BindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  ContractDefinitionInput,
  PublisherDefinition,
  QueueDefinition,
} from "../types.js";
import { isEventConsumerResult, isEventPublisherConfig } from "./event.js";
import { definePublisherInternal } from "./publisher.js";
import { isCommandConsumerConfig } from "./command.js";
import { isQueueWithTtlBackoffInfrastructure } from "./queue.js";

/**
 * Type utility to produce the output contract type from the input.
 * The output preserves the exact input type structure to maintain all specific
 * type information (routing keys, message types, etc.) while the runtime
 * transforms the values correctly.
 */
type ContractOutput<TContract extends ContractDefinitionInput> = TContract;

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
export function defineContract<TContract extends ContractDefinitionInput>(
  definition: TContract,
): ContractOutput<TContract> {
  // Exclude publishers and consumers from spread since they may contain config entries
  const { publishers: inputPublishers, consumers: inputConsumers, ...rest } = definition;
  const result: ContractDefinition = rest as ContractDefinition;

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

    if (Object.keys(queueBindings).length > 0) {
      result.bindings = { ...result.bindings, ...queueBindings };
    }
  }

  // Process publishers section - extract EventPublisherConfig entries
  if (inputPublishers && Object.keys(inputPublishers).length > 0) {
    const processedPublishers: Record<string, PublisherDefinition> = {};

    for (const [name, entry] of Object.entries(inputPublishers)) {
      if (isEventPublisherConfig(entry)) {
        // EventPublisherConfig: extract to publisher definition
        const publisherOptions: { routingKey?: string } = {};
        if (entry.routingKey !== undefined) {
          publisherOptions.routingKey = entry.routingKey;
        }
        processedPublishers[name] = definePublisherInternal(
          entry.exchange,
          entry.message,
          publisherOptions,
        );
      } else {
        // Plain PublisherDefinition
        processedPublishers[name] = entry as PublisherDefinition;
      }
    }

    result.publishers = processedPublishers;
  }

  // Process consumers section - extract EventConsumerResult and CommandConsumerConfig entries
  if (inputConsumers && Object.keys(inputConsumers).length > 0) {
    const processedConsumers: Record<string, ConsumerDefinition> = {};
    const consumerBindings: Record<string, BindingDefinition> = {};

    for (const [name, entry] of Object.entries(inputConsumers)) {
      if (isEventConsumerResult(entry)) {
        // EventConsumerResult: extract consumer and binding
        processedConsumers[name] = entry.consumer;
        consumerBindings[`${name}Binding`] = entry.binding;
      } else if (isCommandConsumerConfig(entry)) {
        // CommandConsumerConfig: extract consumer and binding
        processedConsumers[name] = entry.consumer;
        consumerBindings[`${name}Binding`] = entry.binding;
      } else {
        // Plain ConsumerDefinition
        processedConsumers[name] = entry as ConsumerDefinition;
      }
    }

    result.consumers = processedConsumers;

    if (Object.keys(consumerBindings).length > 0) {
      result.bindings = { ...result.bindings, ...consumerBindings };
    }
  }

  return result as ContractOutput<TContract>;
}
