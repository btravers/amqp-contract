/**
 * Semantic conventions for AMQP messaging attributes
 *
 * Based on OpenTelemetry semantic conventions for messaging systems:
 * https://opentelemetry.io/docs/specs/semconv/messaging/
 */
export const AMQP_ATTRIBUTES = {
  /**
   * The message destination name (exchange or queue)
   */
  MESSAGING_DESTINATION_NAME: "messaging.destination.name",

  /**
   * The kind of messaging operation (publish or receive)
   */
  MESSAGING_OPERATION: "messaging.operation",

  /**
   * The messaging system identifier
   */
  MESSAGING_SYSTEM: "messaging.system",

  /**
   * The routing key used for message routing
   */
  MESSAGING_RABBITMQ_ROUTING_KEY: "messaging.rabbitmq.routing_key",

  /**
   * The exchange type (topic, direct, fanout, headers)
   */
  MESSAGING_RABBITMQ_EXCHANGE_TYPE: "messaging.rabbitmq.exchange_type",

  /**
   * The queue name for consumer operations
   */
  MESSAGING_RABBITMQ_QUEUE_NAME: "messaging.rabbitmq.queue_name",

  /**
   * The consumer name from the contract
   */
  AMQP_CONTRACT_CONSUMER_NAME: "amqp_contract.consumer.name",

  /**
   * The publisher name from the contract
   */
  AMQP_CONTRACT_PUBLISHER_NAME: "amqp_contract.publisher.name",

  /**
   * The batch size for batch processing
   */
  AMQP_CONTRACT_BATCH_SIZE: "amqp_contract.batch.size",

  /**
   * Whether the message passed validation
   */
  AMQP_CONTRACT_VALIDATION_SUCCESS: "amqp_contract.validation.success",
} as const;

/**
 * Operation names for AMQP operations
 */
export const AMQP_OPERATIONS = {
  PUBLISH: "publish",
  RECEIVE: "receive",
  PROCESS: "process",
} as const;

/**
 * Messaging system identifier
 */
export const MESSAGING_SYSTEM_AMQP = "rabbitmq";

/**
 * Trace context header names for AMQP message properties
 */
export const TRACE_CONTEXT_HEADERS = {
  TRACEPARENT: "traceparent",
  TRACESTATE: "tracestate",
} as const;
