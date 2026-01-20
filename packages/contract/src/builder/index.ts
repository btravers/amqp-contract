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

// Publisher-first pattern
export { definePublisherFirst } from "./publisher-first.js";
export type {
  PublisherFirstResult,
  PublisherFirstResultWithRoutingKey,
} from "./publisher-first.js";

// Consumer-first pattern
export { defineConsumerFirst } from "./consumer-first.js";
export type { ConsumerFirstResult, ConsumerFirstResultWithRoutingKey } from "./consumer-first.js";

// TTL-backoff infrastructure
export { defineTtlBackoffRetryInfrastructure } from "./ttl-backoff.js";
export type { TtlBackoffRetryInfrastructure } from "./ttl-backoff.js";
