import type { Result } from "@swan-io/boxed";

/**
 * Protocol types supported by the engine abstraction.
 * This allows the system to support multiple messaging protocols.
 */
export type Protocol = "amqp" | "kafka" | "redis" | "bullmq" | "custom";

/**
 * Generic message payload that can be sent through any engine.
 * The payload is validated using Standard Schema v1 compatible schemas.
 */
export type MessagePayload = unknown;

/**
 * Generic message properties that are common across all engines.
 * Each engine implementation can extend this with protocol-specific properties.
 */
export type MessageProperties = {
  /**
   * Unique identifier for the message
   */
  messageId?: string;

  /**
   * Timestamp when the message was created
   */
  timestamp?: number;

  /**
   * Content type of the message payload (e.g., 'application/json')
   */
  contentType?: string;

  /**
   * Content encoding of the message (e.g., 'gzip', 'deflate')
   */
  contentEncoding?: string;

  /**
   * Correlation ID for request/response patterns
   */
  correlationId?: string;

  /**
   * Reply-to address for request/response patterns
   */
  replyTo?: string;

  /**
   * Message expiration time in milliseconds
   */
  expiration?: number;

  /**
   * Message priority (0-255)
   */
  priority?: number;

  /**
   * Custom headers/metadata
   */
  headers?: Record<string, unknown>;

  /**
   * Protocol-specific properties
   */
  [key: string]: unknown;
};

/**
 * A message that can be published through the engine.
 */
export type PublishableMessage = {
  /** The routing key or topic for the message */
  routingKey: string;
  /** The message payload */
  payload: MessagePayload;
  /** Optional message properties */
  properties?: MessageProperties;
};

/**
 * A message received from the engine with metadata.
 */
export type ReceivedMessage<TPayload = MessagePayload> = {
  /** The validated and typed payload */
  payload: TPayload;
  /** Message properties and metadata */
  properties: MessageProperties;
  /** Original raw message for acknowledgment */
  raw: unknown;
};

/**
 * Options for publishing messages.
 */
export type PublishOptions = {
  /** Whether to wait for confirmation from the broker */
  confirm?: boolean;
  /** Timeout for publish operation in milliseconds */
  timeout?: number;
  /** Protocol-specific options */
  [key: string]: unknown;
};

/**
 * Options for consuming messages.
 */
export type ConsumeOptions = {
  /** Number of messages to prefetch */
  prefetch?: number;
  /** Whether to automatically acknowledge messages */
  autoAck?: boolean;
  /** Consumer tag for identification */
  consumerTag?: string;
  /** Protocol-specific options */
  [key: string]: unknown;
};

/**
 * Message acknowledgment interface.
 */
export type MessageAck = {
  /** Acknowledge the message */
  ack: () => Promise<void>;
  /** Reject the message (optionally requeue) */
  nack: (requeue?: boolean) => Promise<void>;
  /** Reject and requeue the message */
  reject: (requeue?: boolean) => Promise<void>;
};

/**
 * Handler function for processing consumed messages.
 */
export type MessageHandler<TPayload = MessagePayload> = (
  message: ReceivedMessage<TPayload>,
  ack: MessageAck,
) => Promise<void> | void;

/**
 * Engine-agnostic channel definition.
 * A channel represents a logical communication path.
 */
export type ChannelDefinition = {
  /** Channel name/identifier */
  name: string;
  /** Protocol used by this channel */
  protocol: Protocol;
  /** Protocol-specific configuration */
  config?: Record<string, unknown>;
};

/**
 * Engine-agnostic exchange/topic definition.
 * Maps to AMQP exchanges, Kafka topics, Redis channels, etc.
 */
export type ExchangeDefinition = {
  /** Exchange/topic name */
  name: string;
  /** Exchange type (for AMQP) or equivalent */
  type?: string;
  /** Whether the exchange/topic is durable */
  durable?: boolean;
  /** Whether to auto-delete when unused */
  autoDelete?: boolean;
  /** Protocol-specific arguments */
  arguments?: Record<string, unknown>;
};

/**
 * Engine-agnostic queue definition.
 * Maps to AMQP queues, Kafka consumer groups, Bull queues, etc.
 */
export type QueueDefinition = {
  /** Queue name */
  name: string;
  /** Whether the queue is durable */
  durable?: boolean;
  /** Whether the queue is exclusive */
  exclusive?: boolean;
  /** Whether to auto-delete when unused */
  autoDelete?: boolean;
  /** Maximum number of messages */
  maxLength?: number;
  /** Message time-to-live in milliseconds */
  messageTtl?: number;
  /** Protocol-specific arguments */
  arguments?: Record<string, unknown>;
};

/**
 * Engine-agnostic binding definition.
 * Connects queues to exchanges/topics.
 */
export type BindingDefinition = {
  /** Queue to bind */
  queue: string;
  /** Exchange/topic to bind to */
  exchange: string;
  /** Routing key/pattern */
  routingKey?: string;
  /** Protocol-specific arguments */
  arguments?: Record<string, unknown>;
};

/**
 * Topology setup result.
 */
export type TopologySetupResult = Result<void, Error>;

/**
 * Connection configuration for engines.
 */
export type ConnectionConfig = {
  /** Connection URLs/hosts */
  urls: string[];
  /** Protocol to use */
  protocol: Protocol;
  /** Connection options */
  options?: Record<string, unknown>;
};

/**
 * Engine status.
 */
export type EngineStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Engine metrics for monitoring.
 */
export type EngineMetrics = {
  /** Number of published messages */
  messagesPublished: number;
  /** Number of consumed messages */
  messagesConsumed: number;
  /** Number of failed messages */
  messagesFailed: number;
  /** Current connection status */
  status: EngineStatus;
  /** Protocol-specific metrics */
  [key: string]: unknown;
};
