import type {
  BindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  ContractDefinitionInput,
  ContractOutput,
  ExchangeDefinition,
  PublisherDefinition,
  QueueDefinition,
} from "../types.js";
import { isEventConsumerResult, isEventPublisherConfig } from "./event.js";
import { definePublisherInternal } from "./publisher.js";
import { isBridgedPublisherConfig, isCommandConsumerConfig } from "./command.js";
import { createTtlBackoffInfrastructure } from "./queue.js";

/**
 * Define an AMQP contract.
 *
 * A contract is the central definition of your AMQP messaging topology. It brings together
 * publishers and consumers in a single, type-safe definition. Exchanges, queues, and bindings
 * are automatically extracted from publishers and consumers.
 *
 * The contract is used by both clients (for publishing) and workers (for consuming) to ensure
 * type safety throughout your messaging infrastructure. TypeScript will infer all message types
 * and publisher/consumer names from the contract.
 *
 * @param definition - The contract definition containing publishers and consumers
 * @param definition.publishers - Named publisher definitions for sending messages
 * @param definition.consumers - Named consumer definitions for receiving messages
 * @returns The contract definition with fully inferred exchanges, queues, bindings, publishers, and consumers
 *
 * @example
 * ```typescript
 * import {
 *   defineContract,
 *   defineExchange,
 *   defineQueue,
 *   defineEventPublisher,
 *   defineEventConsumer,
 *   defineMessage,
 * } from '@amqp-contract/contract';
 * import { z } from 'zod';
 *
 * // Define resources
 * const ordersExchange = defineExchange('orders', 'topic', { durable: true });
 * const dlx = defineExchange('orders-dlx', 'direct', { durable: true });
 * const orderQueue = defineQueue('order-processing', {
 *   deadLetter: { exchange: dlx },
 *   retry: { mode: 'quorum-native' },
 *   deliveryLimit: 3,
 * });
 * const orderMessage = defineMessage(
 *   z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   })
 * );
 *
 * // Define event publisher
 * const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
 *   routingKey: 'order.created',
 * });
 *
 * // Compose contract - exchanges, queues, bindings are auto-extracted
 * export const contract = defineContract({
 *   publishers: {
 *     orderCreated: orderCreatedEvent,
 *   },
 *   consumers: {
 *     processOrder: defineEventConsumer(orderCreatedEvent, orderQueue),
 *   },
 * });
 *
 * // TypeScript now knows:
 * // - contract.exchanges.orders, contract.exchanges['orders-dlx']
 * // - contract.queues['order-processing']
 * // - contract.bindings.processOrderBinding
 * // - client.publish('orderCreated', { orderId: string, amount: number })
 * // - handler: (message: { orderId: string, amount: number }) => Future<Result<void, HandlerError>>
 * ```
 */
export function defineContract<TContract extends ContractDefinitionInput>(
  definition: TContract,
): ContractOutput<TContract> {
  const { publishers: inputPublishers, consumers: inputConsumers } = definition;
  const result: ContractDefinition = {
    exchanges: {},
    queues: {},
    bindings: {},
    publishers: {},
    consumers: {},
  };

  // Process publishers section - extract exchanges and convert EventPublisherConfig entries
  if (inputPublishers && Object.keys(inputPublishers).length > 0) {
    const processedPublishers: Record<string, PublisherDefinition> = {};
    const exchanges: Record<string, ExchangeDefinition> = {};
    const publisherBindings: Record<string, BindingDefinition> = {};

    for (const [name, entry] of Object.entries(inputPublishers)) {
      if (isBridgedPublisherConfig(entry)) {
        // BridgedPublisherConfig: extract publisher, exchanges, and e2e binding
        exchanges[entry.bridgeExchange.name] = entry.bridgeExchange;
        exchanges[entry.targetExchange.name] = entry.targetExchange;
        publisherBindings[`${name}ExchangeBinding`] = entry.exchangeBinding;
        processedPublishers[name] = entry.publisher;
      } else if (isEventPublisherConfig(entry)) {
        // EventPublisherConfig: extract exchange and convert to publisher definition
        exchanges[entry.exchange.name] = entry.exchange;
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
        // Plain PublisherDefinition: extract exchange
        const publisher = entry as PublisherDefinition;
        exchanges[publisher.exchange.name] = publisher.exchange;
        processedPublishers[name] = publisher;
      }
    }

    result.publishers = processedPublishers;
    result.exchanges = { ...result.exchanges, ...exchanges };
    result.bindings = { ...result.bindings, ...publisherBindings };
  }

  // Process consumers section - extract queues, exchanges, bindings, and consumer definitions
  if (inputConsumers && Object.keys(inputConsumers).length > 0) {
    const processedConsumers: Record<string, ConsumerDefinition> = {};
    const consumerBindings: Record<string, BindingDefinition> = {};
    const queues: Record<string, QueueDefinition> = {};
    const exchanges: Record<string, ExchangeDefinition> = {};

    for (const [name, entry] of Object.entries(inputConsumers)) {
      if (isEventConsumerResult(entry)) {
        // EventConsumerResult: extract consumer, binding, queue, and exchange
        processedConsumers[name] = entry.consumer;
        consumerBindings[`${name}Binding`] = entry.binding;

        // Extract queue (handle TTL-backoff infrastructure)
        const queueEntry = entry.consumer.queue;
        queues[queueEntry.name] = queueEntry;

        // Extract exchange from binding
        exchanges[entry.binding.exchange.name] = entry.binding.exchange;

        // Extract dead letter exchange if present
        if (queueEntry.deadLetter?.exchange) {
          exchanges[queueEntry.deadLetter.exchange.name] = queueEntry.deadLetter.exchange;
        }

        // Extract bridge exchange and e2e binding if present
        if (entry.exchangeBinding) {
          consumerBindings[`${name}ExchangeBinding`] = entry.exchangeBinding;
        }
        if (entry.bridgeExchange) {
          exchanges[entry.bridgeExchange.name] = entry.bridgeExchange;
        }
        // Also extract the source exchange (stored in entry.exchange for bridged consumers)
        if (entry.exchange) {
          exchanges[entry.exchange.name] = entry.exchange;
        }
      } else if (isCommandConsumerConfig(entry)) {
        // CommandConsumerConfig: extract consumer, binding, queue, and exchange
        processedConsumers[name] = entry.consumer;
        consumerBindings[`${name}Binding`] = entry.binding;

        // Extract queue (handle TTL-backoff infrastructure)
        const queueEntry = entry.consumer.queue;
        queues[queueEntry.name] = queueEntry;

        // Extract exchange
        exchanges[entry.exchange.name] = entry.exchange;

        // Extract dead letter exchange if present
        if (queueEntry.deadLetter?.exchange) {
          exchanges[queueEntry.deadLetter.exchange.name] = queueEntry.deadLetter.exchange;
        }
      } else {
        // Plain ConsumerDefinition: extract queue
        const consumer = entry as ConsumerDefinition;
        processedConsumers[name] = consumer;

        // Extract queue (handle TTL-backoff infrastructure)
        const queueEntry = consumer.queue;
        queues[queueEntry.name] = queueEntry;

        // Extract dead letter exchange if present
        if (queueEntry.deadLetter?.exchange) {
          exchanges[queueEntry.deadLetter.exchange.name] = queueEntry.deadLetter.exchange;
        }
      }
    }

    // Auto-generate TTL-backoff retry infrastructure for queues with retry.mode === "ttl-backoff" and deadLetter
    for (const queue of Object.values(queues) as QueueDefinition[]) {
      if (queue.retry?.mode === "ttl-backoff" && queue.deadLetter) {
        const infra = createTtlBackoffInfrastructure(queue);
        queues[infra.waitQueue.name] = infra.waitQueue;
        consumerBindings[`${queue.name}WaitBinding`] = infra.waitQueueBinding;
        consumerBindings[`${queue.name}RetryBinding`] = infra.mainQueueRetryBinding;
        exchanges[queue.deadLetter.exchange.name] = queue.deadLetter.exchange;
      }
    }

    result.consumers = processedConsumers;
    result.bindings = { ...result.bindings, ...consumerBindings };
    result.queues = { ...result.queues, ...queues };
    result.exchanges = { ...result.exchanges, ...exchanges };
  }

  return result as ContractOutput<TContract>;
}
