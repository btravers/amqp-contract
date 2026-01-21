/**
 * Builder functions for defining AMQP contracts.
 *
 * This module re-exports all builder functions from the modular builder directory.
 * For implementation details, see the individual modules in `./builder/`.
 *
 * @packageDocumentation
 */

// Re-export everything from the modular builder
export {
  // Exchange
  defineExchange,
  // Message
  defineMessage,
  // Queue
  defineQueue,
  defineQuorumQueue,
  defineTtlBackoffQueue,
  extractQueue,
  isQueueWithTtlBackoffInfrastructure,
  // Bindings
  defineQueueBinding,
  defineExchangeBinding,
  // Publisher
  definePublisher,
  // Consumer
  defineConsumer,
  // Contract
  defineContract,
  // Event pattern
  defineEventPublisher,
  defineEventConsumer,
  isEventPublisherConfig,
  // Command pattern
  defineCommandConsumer,
  defineCommandPublisher,
  isCommandConsumerConfig,
  // TTL-backoff infrastructure
  defineTtlBackoffRetryInfrastructure,
} from "./builder/index.js";

// Re-export types
export type {
  // Routing types
  RoutingKey,
  BindingPattern,
  MatchingRoutingKey,
  // Event pattern types
  EventPublisherConfig,
  EventConsumerResult,
  // Command pattern types
  CommandConsumerConfig,
  // TTL-backoff types
  TtlBackoffRetryInfrastructure,
  // Queue helper types
  DefineQuorumQueueOptions,
  DefineTtlBackoffQueueOptions,
} from "./builder/index.js";
