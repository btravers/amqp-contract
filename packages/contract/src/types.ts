import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Any schema that conforms to Standard Schema v1.
 *
 * This library supports any validation library that implements the Standard Schema v1 specification,
 * including Zod, Valibot, and ArkType. This allows you to use your preferred validation library
 * while maintaining type safety.
 *
 * @see https://github.com/standard-schema/standard-schema
 */
export type AnySchema = StandardSchemaV1;

/**
 * Supported compression algorithms for message payloads.
 *
 * - `gzip`: GZIP compression (standard, widely supported, good compression ratio)
 * - `deflate`: DEFLATE compression (faster than gzip, slightly less compression)
 * - `none` or `undefined`: No compression
 *
 * When compression is enabled, the message payload is compressed before publishing
 * and automatically decompressed when consuming. The `content-encoding` AMQP
 * message property is set to indicate the compression algorithm used.
 *
 * @example
 * ```typescript
 * const publisher = definePublisher(exchange, message, {
 *   routingKey: 'order.created',
 *   compression: 'gzip'
 * });
 * ```
 */
export type CompressionAlgorithm = "gzip" | "deflate";

/**
 * Base definition of an AMQP exchange.
 *
 * An exchange receives messages from publishers and routes them to queues based on the exchange
 * type and routing rules. This type contains properties common to all exchange types.
 */
export type BaseExchangeDefinition = {
  /**
   * The name of the exchange. Must be unique within the RabbitMQ virtual host.
   */
  name: string;

  /**
   * If true, the exchange survives broker restarts. Durable exchanges are persisted to disk.
   * @default false
   */
  durable?: boolean;

  /**
   * If true, the exchange is deleted when all queues have finished using it.
   * @default false
   */
  autoDelete?: boolean;

  /**
   * If true, the exchange cannot be directly published to by clients.
   * It can only receive messages from other exchanges via exchange-to-exchange bindings.
   * @default false
   */
  internal?: boolean;

  /**
   * Additional AMQP arguments for advanced configuration.
   * Common arguments include alternate-exchange for handling unroutable messages.
   */
  arguments?: Record<string, unknown>;
};

/**
 * A fanout exchange definition.
 *
 * Fanout exchanges broadcast all messages to all bound queues, ignoring routing keys.
 * This is the simplest exchange type for pub/sub messaging patterns.
 *
 * @example
 * ```typescript
 * const logsExchange: FanoutExchangeDefinition = defineExchange('logs', 'fanout', {
 *   durable: true
 * });
 * ```
 */
export type FanoutExchangeDefinition = BaseExchangeDefinition & {
  type: "fanout";
};

/**
 * A direct exchange definition.
 *
 * Direct exchanges route messages to queues based on exact routing key matches.
 * This is ideal for point-to-point messaging where each message should go to specific queues.
 *
 * @example
 * ```typescript
 * const tasksExchange: DirectExchangeDefinition = defineExchange('tasks', 'direct', {
 *   durable: true
 * });
 * ```
 */
export type DirectExchangeDefinition = BaseExchangeDefinition & {
  type: "direct";
};

/**
 * A topic exchange definition.
 *
 * Topic exchanges route messages to queues based on routing key patterns with wildcards:
 * - `*` (star) matches exactly one word
 * - `#` (hash) matches zero or more words
 *
 * Words are separated by dots (e.g., `order.created.high-value`).
 *
 * @example
 * ```typescript
 * const ordersExchange: TopicExchangeDefinition = defineExchange('orders', 'topic', {
 *   durable: true
 * });
 * // Can be bound with patterns like 'order.*' or 'order.#'
 * ```
 */
export type TopicExchangeDefinition = BaseExchangeDefinition & {
  type: "topic";
};

/**
 * Union type of all exchange definitions.
 *
 * Represents any type of AMQP exchange: fanout, direct, or topic.
 */
export type ExchangeDefinition =
  | FanoutExchangeDefinition
  | DirectExchangeDefinition
  | TopicExchangeDefinition;

/**
 * Configuration for dead letter exchange (DLX) on a queue.
 *
 * When a message in a queue is rejected, expires, or exceeds the queue length limit,
 * it can be automatically forwarded to a dead letter exchange for further processing
 * or storage.
 */
export type DeadLetterConfig = {
  /**
   * The exchange to send dead-lettered messages to.
   * This exchange must be declared in the contract.
   */
  exchange: ExchangeDefinition;

  /**
   * Optional routing key to use when forwarding messages to the dead letter exchange.
   * If not specified, the original message routing key is used.
   */
  routingKey?: string;
};

/**
 * Definition of an AMQP queue.
 *
 * A queue stores messages until they are consumed by workers. Queues are bound to exchanges
 * to receive messages based on routing rules.
 */
export type QueueDefinition = {
  /**
   * The name of the queue. Must be unique within the RabbitMQ virtual host.
   */
  name: string;

  /**
   * If true, the queue survives broker restarts. Durable queues are persisted to disk.
   * @default false
   */
  durable?: boolean;

  /**
   * If true, the queue can only be used by the declaring connection and is deleted when
   * that connection closes. Exclusive queues are private to the connection.
   * @default false
   */
  exclusive?: boolean;

  /**
   * If true, the queue is deleted when the last consumer unsubscribes.
   * @default false
   */
  autoDelete?: boolean;

  /**
   * Dead letter configuration for handling failed or rejected messages.
   *
   * When configured, messages that are rejected, expire, or exceed queue limits
   * will be automatically forwarded to the specified dead letter exchange.
   *
   * @example
   * ```typescript
   * const dlx = defineExchange('orders-dlx', 'topic', { durable: true });
   * const queue = defineQueue('order-processing', {
   *   durable: true,
   *   deadLetter: {
   *     exchange: dlx,
   *     routingKey: 'order.failed'
   *   }
   * });
   * ```
   */
  deadLetter?: DeadLetterConfig;

  /**
   * Additional AMQP arguments for advanced configuration.
   *
   * Common arguments include:
   * - `x-message-ttl`: Message time-to-live in milliseconds
   * - `x-expires`: Queue expiration time in milliseconds
   * - `x-max-length`: Maximum number of messages in the queue
   * - `x-max-length-bytes`: Maximum size of the queue in bytes
   * - `x-max-priority`: Maximum priority level for priority queues
   *
   * Note: When using the `deadLetter` property, the `x-dead-letter-exchange` and
   * `x-dead-letter-routing-key` arguments are automatically set and should not be
   * specified in this arguments object.
   *
   * @example
   * ```typescript
   * {
   *   'x-message-ttl': 86400000, // 24 hours
   *   'x-max-priority': 10
   * }
   * ```
   */
  arguments?: Record<string, unknown>;
};

/**
 * Definition of a message with typed payload and optional headers.
 *
 * @template TPayload - The Standard Schema v1 compatible schema for the message payload
 * @template THeaders - The Standard Schema v1 compatible schema for the message headers (optional)
 */
export type MessageDefinition<
  TPayload extends AnySchema = AnySchema,
  THeaders extends StandardSchemaV1<Record<string, unknown>> | undefined = undefined,
> = {
  /**
   * The payload schema for validating message content.
   * Must be a Standard Schema v1 compatible schema (Zod, Valibot, ArkType, etc.).
   */
  payload: TPayload;

  /**
   * Optional headers schema for validating message metadata.
   * Must be a Standard Schema v1 compatible schema.
   */
  headers?: THeaders;

  /**
   * Brief description of the message for documentation purposes.
   * Used in AsyncAPI specification generation.
   */
  summary?: string;

  /**
   * Detailed description of the message for documentation purposes.
   * Used in AsyncAPI specification generation.
   */
  description?: string;
};

/**
 * Binding between a queue and an exchange.
 *
 * Defines how messages from an exchange should be routed to a queue.
 * For direct and topic exchanges, a routing key is required.
 * For fanout exchanges, no routing key is needed as all messages are broadcast.
 */
export type QueueBindingDefinition = {
  /** Discriminator indicating this is a queue-to-exchange binding */
  type: "queue";

  /** The queue that will receive messages */
  queue: QueueDefinition;

  /**
   * Additional AMQP arguments for the binding.
   * Can be used for advanced routing scenarios with the headers exchange type.
   */
  arguments?: Record<string, unknown>;
} & (
  | {
      /** Direct or topic exchange requiring a routing key */
      exchange: DirectExchangeDefinition | TopicExchangeDefinition;
      /**
       * The routing key pattern for message routing.
       * For direct exchanges: Must match exactly.
       * For topic exchanges: Can use wildcards (* for one word, # for zero or more words).
       */
      routingKey: string;
    }
  | {
      /** Fanout exchange (no routing key needed) */
      exchange: FanoutExchangeDefinition;
      /** Fanout exchanges don't use routing keys */
      routingKey?: never;
    }
);

/**
 * Binding between two exchanges (exchange-to-exchange routing).
 *
 * Defines how messages should be forwarded from a source exchange to a destination exchange.
 * This allows for more complex routing topologies.
 *
 * @example
 * ```typescript
 * // Forward high-priority orders to a special processing exchange
 * const binding: ExchangeBindingDefinition = {
 *   type: 'exchange',
 *   source: ordersExchange,
 *   destination: highPriorityExchange,
 *   routingKey: 'order.high-priority.*'
 * };
 * ```
 */
export type ExchangeBindingDefinition = {
  /** Discriminator indicating this is an exchange-to-exchange binding */
  type: "exchange";

  /** The destination exchange that will receive forwarded messages */
  destination: ExchangeDefinition;

  /**
   * Additional AMQP arguments for the binding.
   */
  arguments?: Record<string, unknown>;
} & (
  | {
      /** Direct or topic source exchange requiring a routing key */
      source: DirectExchangeDefinition | TopicExchangeDefinition;
      /**
       * The routing key pattern for message routing.
       * Messages matching this pattern will be forwarded to the destination exchange.
       */
      routingKey: string;
    }
  | {
      /** Fanout source exchange (no routing key needed) */
      source: FanoutExchangeDefinition;
      /** Fanout exchanges don't use routing keys */
      routingKey?: never;
    }
);

/**
 * Union type of all binding definitions.
 *
 * A binding can be either:
 * - Queue-to-exchange binding: Routes messages from an exchange to a queue
 * - Exchange-to-exchange binding: Forwards messages from one exchange to another
 */
export type BindingDefinition = QueueBindingDefinition | ExchangeBindingDefinition;

/**
 * Definition of a message publisher.
 *
 * A publisher sends messages to an exchange with automatic schema validation.
 * The message payload is validated against the schema before being sent to RabbitMQ.
 *
 * @template TMessage - The message definition with payload schema
 *
 * @example
 * ```typescript
 * const publisher: PublisherDefinition = {
 *   exchange: ordersExchange,
 *   message: orderMessage,
 *   routingKey: 'order.created',
 *   compression: 'gzip' // Optional: compress large messages
 * };
 * ```
 */
export type PublisherDefinition<TMessage extends MessageDefinition = MessageDefinition> = {
  /** The message definition including the payload schema */
  message: TMessage;

  /**
   * Optional compression algorithm for message payloads.
   * When set, messages are automatically compressed before publishing
   * and the content-encoding header is set accordingly.
   * @default undefined (no compression)
   */
  compression?: CompressionAlgorithm;
} & (
  | {
      /** Direct or topic exchange requiring a routing key */
      exchange: DirectExchangeDefinition | TopicExchangeDefinition;
      /**
       * The routing key for message routing.
       * Determines which queues will receive the published message.
       */
      routingKey: string;
    }
  | {
      /** Fanout exchange (no routing key needed) */
      exchange: FanoutExchangeDefinition;
      /** Fanout exchanges don't use routing keys - all bound queues receive the message */
      routingKey?: never;
    }
);

/**
 * Definition of a message consumer.
 *
 * A consumer receives and processes messages from a queue with automatic schema validation.
 * The message payload is validated against the schema before being passed to your handler.
 * If the message is compressed (indicated by the content-encoding header), it will be
 * automatically decompressed before validation.
 *
 * @template TMessage - The message definition with payload schema
 *
 * @example
 * ```typescript
 * const consumer: ConsumerDefinition = {
 *   queue: orderProcessingQueue,
 *   message: orderMessage
 * };
 * ```
 */
export type ConsumerDefinition<TMessage extends MessageDefinition = MessageDefinition> = {
  /** The queue to consume messages from */
  queue: QueueDefinition;

  /** The message definition including the payload schema */
  message: TMessage;
};

/**
 * Complete AMQP contract definition.
 *
 * A contract brings together all AMQP resources into a single, type-safe definition.
 * It defines the complete messaging topology including exchanges, queues, bindings,
 * publishers, and consumers.
 *
 * The contract is used by:
 * - Clients (TypedAmqpClient) for type-safe message publishing
 * - Workers (TypedAmqpWorker) for type-safe message consumption
 * - AsyncAPI generator for documentation
 *
 * @example
 * ```typescript
 * const contract: ContractDefinition = {
 *   exchanges: {
 *     orders: ordersExchange,
 *   },
 *   queues: {
 *     orderProcessing: orderProcessingQueue,
 *   },
 *   bindings: {
 *     orderBinding: orderQueueBinding,
 *   },
 *   publishers: {
 *     orderCreated: orderCreatedPublisher,
 *   },
 *   consumers: {
 *     processOrder: processOrderConsumer,
 *   },
 * };
 * ```
 */
export type ContractDefinition = {
  /**
   * Named exchange definitions.
   * Each key becomes available as a named resource in the contract.
   */
  exchanges?: Record<string, ExchangeDefinition>;

  /**
   * Named queue definitions.
   * Each key becomes available as a named resource in the contract.
   */
  queues?: Record<string, QueueDefinition>;

  /**
   * Named binding definitions.
   * Bindings can be queue-to-exchange or exchange-to-exchange.
   */
  bindings?: Record<string, BindingDefinition>;

  /**
   * Named publisher definitions.
   * Each key becomes a method on the TypedAmqpClient for publishing messages.
   * The method will be fully typed based on the message schema.
   */
  publishers?: Record<string, PublisherDefinition>;

  /**
   * Named consumer definitions.
   * Each key requires a corresponding handler in the TypedAmqpWorker.
   * The handler will be fully typed based on the message schema.
   */
  consumers?: Record<string, ConsumerDefinition>;
};

/**
 * Extract publisher names from a contract.
 *
 * This utility type extracts the keys of all publishers defined in a contract.
 * It's used internally for type inference in the TypedAmqpClient.
 *
 * @template TContract - The contract definition
 * @returns Union of publisher names, or never if no publishers defined
 *
 * @example
 * ```typescript
 * type PublisherNames = InferPublisherNames<typeof myContract>;
 * // Result: 'orderCreated' | 'orderUpdated' | 'orderCancelled'
 * ```
 */
export type InferPublisherNames<TContract extends ContractDefinition> =
  TContract["publishers"] extends Record<string, unknown> ? keyof TContract["publishers"] : never;

/**
 * Extract consumer names from a contract.
 *
 * This utility type extracts the keys of all consumers defined in a contract.
 * It's used internally for type inference in the TypedAmqpWorker.
 *
 * @template TContract - The contract definition
 * @returns Union of consumer names, or never if no consumers defined
 *
 * @example
 * ```typescript
 * type ConsumerNames = InferConsumerNames<typeof myContract>;
 * // Result: 'processOrder' | 'sendNotification' | 'updateInventory'
 * ```
 */
export type InferConsumerNames<TContract extends ContractDefinition> =
  TContract["consumers"] extends Record<string, unknown> ? keyof TContract["consumers"] : never;
