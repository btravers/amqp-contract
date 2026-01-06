/* eslint-disable sort-imports */
import type { Future, Result } from "@swan-io/boxed";
import type {
  BindingDefinition,
  ConnectionConfig,
  ConsumeOptions,
  EngineMetrics,
  EngineStatus,
  ExchangeDefinition,
  MessageHandler,
  MessagePayload,
  PublishOptions,
  PublishableMessage,
  QueueDefinition,
  TopologySetupResult,
} from "./types.js";

/**
 * Core interface that all messaging engine implementations must implement.
 * This abstraction allows the library to support multiple messaging protocols
 * (AMQP/RabbitMQ, Kafka, BullMQ, Redis, etc.) through a unified interface.
 *
 * @example
 * ```typescript
 * // AMQP implementation
 * class AmqpMessageEngine implements MessageEngine {
 *   async connect(config: ConnectionConfig): Promise<void> {
 *     // Connect to RabbitMQ
 *   }
 *   // ... implement other methods
 * }
 *
 * // Kafka implementation
 * class KafkaMessageEngine implements MessageEngine {
 *   async connect(config: ConnectionConfig): Promise<void> {
 *     // Connect to Kafka
 *   }
 *   // ... implement other methods
 * }
 * ```
 */
export type MessageEngine = {
  /**
   * Connect to the messaging broker/service.
   *
   * @param config - Connection configuration including URLs and protocol
   * @returns Future resolving to Result with void on success or Error on failure
   */
  connect(config: ConnectionConfig): Future<Result<void, Error>>;

  /**
   * Disconnect from the messaging broker/service.
   *
   * @returns Future resolving to Result with void on success or Error on failure
   */
  disconnect(): Future<Result<void, Error>>;

  /**
   * Get the current connection status.
   *
   * @returns The current engine status
   */
  getStatus(): EngineStatus;

  /**
   * Wait for the connection to be ready.
   * Useful for ensuring the engine is connected before performing operations.
   *
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns Future resolving to Result with void on success or Error on timeout/failure
   */
  waitForReady(timeoutMs?: number): Future<Result<void, Error>>;

  /**
   * Publish a message to an exchange/topic.
   *
   * @param exchange - The exchange/topic name to publish to
   * @param message - The message to publish
   * @param options - Optional publish options
   * @returns Future resolving to Result with void on success or Error on failure
   */
  publish(
    exchange: string,
    message: PublishableMessage,
    options?: PublishOptions,
  ): Future<Result<void, Error>>;

  /**
   * Start consuming messages from a queue.
   *
   * @param queue - The queue name to consume from
   * @param handler - Handler function to process messages
   * @param options - Optional consume options
   * @returns Future resolving to Result with consumer tag on success or Error on failure
   */
  consume(
    queue: string,
    handler: MessageHandler<MessagePayload>,
    options?: ConsumeOptions,
  ): Future<Result<string, Error>>;

  /**
   * Stop consuming messages from a queue.
   *
   * @param consumerTag - The consumer tag returned from consume()
   * @returns Future resolving to Result with void on success or Error on failure
   */
  cancel(consumerTag: string): Future<Result<void, Error>>;

  /**
   * Get engine metrics for monitoring.
   *
   * @returns Current engine metrics
   */
  getMetrics(): EngineMetrics;
};

/**
 * Interface for setting up messaging topology (exchanges, queues, bindings).
 * Separated from MessageEngine to allow different implementations for setup vs runtime operations.
 */
export type TopologyEngine = {
  /**
   * Assert that an exchange/topic exists, creating it if necessary.
   *
   * @param exchange - The exchange definition
   * @returns Future resolving to Result with void on success or Error on failure
   */
  assertExchange(exchange: ExchangeDefinition): Future<TopologySetupResult>;

  /**
   * Assert that a queue exists, creating it if necessary.
   *
   * @param queue - The queue definition
   * @returns Future resolving to Result with void on success or Error on failure
   */
  assertQueue(queue: QueueDefinition): Future<TopologySetupResult>;

  /**
   * Bind a queue to an exchange/topic.
   *
   * @param binding - The binding definition
   * @returns Future resolving to Result with void on success or Error on failure
   */
  bindQueue(binding: BindingDefinition): Future<TopologySetupResult>;

  /**
   * Delete an exchange/topic.
   *
   * @param exchange - The exchange name
   * @returns Future resolving to Result with void on success or Error on failure
   */
  deleteExchange(exchange: string): Future<TopologySetupResult>;

  /**
   * Delete a queue.
   *
   * @param queue - The queue name
   * @returns Future resolving to Result with void on success or Error on failure
   */
  deleteQueue(queue: string): Future<TopologySetupResult>;

  /**
   * Unbind a queue from an exchange/topic.
   *
   * @param binding - The binding to remove
   * @returns Future resolving to Result with void on success or Error on failure
   */
  unbindQueue(binding: BindingDefinition): Future<TopologySetupResult>;
};

/**
 * Combined engine interface that provides both messaging and topology operations.
 * Most engine implementations will implement this combined interface.
 */
export type FullMessageEngine = MessageEngine & TopologyEngine;

/**
 * Factory function type for creating engine instances.
 * This allows for dependency injection and testing.
 */
export type EngineFactory<TEngine extends MessageEngine = MessageEngine> = (
  config: ConnectionConfig,
) => TEngine;
