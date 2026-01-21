/**
 * Builder functions for defining AMQP contracts.
 *
 * @packageDocumentation
 */

// Exchange
export { defineExchange } from "./exchange.js";

// Message
export { defineMessage } from "./message.js";

// Queue
export {
  defineQueue,
  defineQuorumQueue,
  defineTtlBackoffQueue,
  extractQueue,
  isQueueWithTtlBackoffInfrastructure,
} from "./queue.js";
export type { DefineQuorumQueueOptions, DefineTtlBackoffQueueOptions } from "./queue.js";

// Bindings
export { defineQueueBinding, defineExchangeBinding } from "./binding.js";

// Publisher
export { definePublisher } from "./publisher.js";

// Consumer
export { defineConsumer } from "./consumer.js";

// Contract
export { defineContract } from "./contract.js";

// Routing types
export type { RoutingKey, BindingPattern, MatchingRoutingKey } from "./routing-types.js";

// Event pattern
export { defineEventPublisher, defineEventConsumer, isEventPublisherConfig } from "./event.js";
export type { EventPublisherConfig, EventConsumerResult } from "./event.js";

// Command pattern
export {
  defineCommandConsumer,
  defineCommandPublisher,
  isCommandConsumerConfig,
} from "./command.js";
export type { CommandConsumerConfig } from "./command.js";

// TTL-backoff infrastructure
export { defineTtlBackoffRetryInfrastructure } from "./ttl-backoff.js";
export type { TtlBackoffRetryInfrastructure } from "./ttl-backoff.js";
