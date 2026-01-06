/**
 * @amqp-contract/engine - Core engine abstraction layer
 *
 * This package provides the core interfaces and types for implementing
 * messaging engine adapters. It allows amqp-contract to support multiple
 * messaging protocols (AMQP/RabbitMQ, Kafka, BullMQ, Redis, etc.) through
 * a unified interface.
 *
 * @packageDocumentation
 */

export type {
  Protocol,
  MessagePayload,
  MessageProperties,
  PublishableMessage,
  ReceivedMessage,
  PublishOptions,
  ConsumeOptions,
  MessageAck,
  MessageHandler,
  ChannelDefinition,
  ExchangeDefinition,
  QueueDefinition,
  BindingDefinition,
  TopologySetupResult,
  ConnectionConfig,
  EngineStatus,
  EngineMetrics,
} from "./types.js";

export type {
  MessageEngine,
  TopologyEngine,
  FullMessageEngine,
  EngineFactory,
} from "./interfaces.js";
