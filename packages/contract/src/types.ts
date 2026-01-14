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
 *
 * Compression is configured at runtime via PublishOptions when calling
 * AmqpClient.publish, not at publisher definition time.
 *
 * When compression is enabled, the message payload is compressed before publishing
 * and automatically decompressed when consuming. The `content-encoding` AMQP
 * message property is set to indicate the compression algorithm used.
 *
 * To disable compression, simply omit the `compression` option (it's optional).
 *
 * @example
 * ```typescript
 * // Define a publisher without compression configuration
 * const orderCreatedPublisher = definePublisher(exchange, message, {
 *   routingKey: "order.created",
 * });
 *
 * // Later, choose whether to compress at publish time
 * await client.publish("orderCreated", payload, {
 *   compression: "gzip",
 * });
 * ```
 */
export type CompressionAlgorithm = "gzip" | "deflate";

/**
 * Supported queue types in RabbitMQ.
 *
 * - `quorum`: Quorum queues (default, recommended) - Provide better durability and high-availability
 *   using the Raft consensus algorithm. Best for most production use cases.
 * - `classic`: Classic queues - The traditional RabbitMQ queue type. Use only when you need
 *   specific features not supported by quorum queues (e.g., non-durable queues, priority queues).
 *
 * Note: Quorum queues require `durable: true` and do not support `exclusive: true`.
 * When using quorum queues, `durable` is automatically set to `true`.
 *
 * @see https://www.rabbitmq.com/docs/quorum-queues
 *
 * @example
 * ```typescript
 * // Create a quorum queue (default, recommended)
 * const orderQueue = defineQueue('order-processing', {
 *   type: 'quorum', // This is the default
 * });
 *
 * // Create a classic queue (for special cases)
 * const tempQueue = defineQueue('temp-queue', {
 *   type: 'classic',
 *   durable: false, // Only supported with classic queues
 * });
 * ```
 */
export type QueueType = "quorum" | "classic";

// =============================================================================
// Retry Configuration Types
// =============================================================================

/**
 * TTL-backoff retry configuration.
 *
 * This mode uses a wait queue pattern with per-message TTL for exponential backoff.
 * When a message fails processing, it is published to a wait queue with a TTL.
 * When the TTL expires, the message is dead-lettered back to the main queue for retry.
 *
 * @example
 * ```typescript
 * const retryConfig: TtlBackoffRetryConfig = {
 *   mode: "ttl-backoff",
 *   maxRetries: 5,
 *   initialDelayMs: 1000,
 *   maxDelayMs: 30000,
 *   backoffMultiplier: 2,
 *   jitter: true,
 * };
 * ```
 */
export type TtlBackoffRetryConfig = {
  /** Retry mode identifier */
  mode: "ttl-backoff";

  /**
   * Maximum number of retry attempts before sending to DLQ.
   * @default 3
   */
  maxRetries: number;

  /**
   * Initial delay in milliseconds before first retry.
   * @default 1000
   */
  initialDelayMs: number;

  /**
   * Maximum delay in milliseconds between retries.
   * The exponential backoff will be capped at this value.
   * @default 30000
   */
  maxDelayMs: number;

  /**
   * Multiplier for exponential backoff calculation.
   * Formula: delay = min(initialDelayMs * (backoffMultiplier ^ retryCount), maxDelayMs)
   * @default 2
   */
  backoffMultiplier: number;

  /**
   * Whether to add random jitter to prevent thundering herd.
   * When enabled, the delay is multiplied by a random factor between 0.5 and 1.0.
   * @default true
   */
  jitter: boolean;
};

/**
 * Quorum-native retry configuration.
 *
 * This mode uses RabbitMQ's native delivery limit feature for quorum queues.
 * No wait queue is needed - RabbitMQ handles retry tracking via x-delivery-count.
 * Messages are dead-lettered when the delivery limit is exceeded.
 *
 * Requirements:
 * - Queue must be a quorum queue (type: "quorum")
 * - Queue must have `deliveryLimit` configured
 *
 * @example
 * ```typescript
 * const queue = defineQueue("orders", {
 *   type: "quorum",
 *   deliveryLimit: 5,
 *   deadLetter: { exchange: dlx },
 * });
 * // The queue inherently uses quorum-native retry via deliveryLimit
 * ```
 */
export type QuorumNativeRetryConfig = {
  /** Retry mode identifier */
  mode: "quorum-native";
};

/**
 * Retry configuration for a queue.
 *
 * This is a discriminated union based on the `mode` property:
 * - `ttl-backoff`: Uses wait queue pattern with exponential backoff
 * - `quorum-native`: Uses RabbitMQ's native delivery limit (quorum queues only)
 */
export type QueueRetryConfig = TtlBackoffRetryConfig | QuorumNativeRetryConfig;

/**
 * Common queue options shared between quorum and classic queues.
 */
type BaseQueueOptions = {
  /**
   * If true, the queue survives broker restarts. Durable queues are persisted to disk.
   * Note: Quorum queues are always durable regardless of this setting.
   * @default false (but forced to true for quorum queues during setup)
   */
  durable?: boolean;

  /**
   * If true, the queue is deleted when the last consumer unsubscribes.
   * @default false
   */
  autoDelete?: boolean;

  /**
   * Dead letter configuration for handling failed or rejected messages.
   */
  deadLetter?: DeadLetterConfig;

  /**
   * Additional AMQP arguments for advanced configuration.
   */
  arguments?: Record<string, unknown>;
};

/**
 * Options for creating a quorum queue.
 *
 * Quorum queues do not support:
 * - `exclusive` - Use classic queues for exclusive access
 * - `maxPriority` - Use classic queues for priority queues
 *
 * Quorum queues provide native retry support via `deliveryLimit`:
 * - RabbitMQ tracks delivery count automatically via `x-delivery-count` header
 * - When the limit is exceeded, messages are dead-lettered (if DLX is configured)
 * - This is simpler than TTL-based retry and avoids head-of-queue blocking issues
 *
 * @example
 * ```typescript
 * const orderQueue = defineQueue('orders', {
 *   type: 'quorum',
 *   deadLetter: { exchange: dlx },
 *   deliveryLimit: 3, // Message dead-lettered after 3 delivery attempts
 * });
 * ```
 */
export type QuorumQueueOptions = BaseQueueOptions & {
  /**
   * Queue type: quorum (default, recommended)
   */
  type?: "quorum";

  /**
   * Quorum queues do not support exclusive mode.
   * Use type: 'classic' if you need exclusive queues.
   */
  exclusive?: undefined;

  /**
   * Quorum queues do not support priority queues.
   * Use type: 'classic' if you need priority queues.
   */
  maxPriority?: undefined;

  /**
   * Maximum number of delivery attempts before the message is dead-lettered.
   *
   * When a message is rejected (nacked) and requeued, RabbitMQ increments
   * the `x-delivery-count` header. When this count reaches the delivery limit,
   * the message is automatically dead-lettered (if DLX is configured) or dropped.
   *
   * This is a quorum queue-specific feature that provides native retry handling
   * without the complexity of TTL-based wait queues.
   *
   * **Benefits over TTL-based retry:**
   * - Simpler architecture (no wait queues needed)
   * - No head-of-queue blocking issues (TTL only works at queue head)
   * - Native RabbitMQ feature with atomic guarantees
   *
   * @minimum 1 - Must be a positive integer (1 or greater)
   *
   * @see https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling
   *
   * @example
   * ```typescript
   * const orderQueue = defineQueue('order-processing', {
   *   type: 'quorum',
   *   deliveryLimit: 5, // Allow up to 5 delivery attempts
   *   deadLetter: {
   *     exchange: dlx,
   *     routingKey: 'order.failed',
   *   },
   * });
   * ```
   */
  deliveryLimit?: number;
};

/**
 * Options for creating a classic queue.
 *
 * Classic queues support all traditional RabbitMQ features including:
 * - `exclusive: true` - For connection-scoped queues
 * - `maxPriority` - For priority queues
 * - `durable: false` - For non-durable queues
 *
 * @example
 * ```typescript
 * const priorityQueue = defineQueue('tasks', {
 *   type: 'classic',
 *   durable: true,
 *   maxPriority: 10,
 * });
 * ```
 */
export type ClassicQueueOptions = BaseQueueOptions & {
  /**
   * Queue type: classic (for special cases)
   */
  type: "classic";

  /**
   * If true, the queue can only be used by the declaring connection and is deleted when
   * that connection closes. Exclusive queues are private to the connection.
   * @default false
   */
  exclusive?: boolean;

  /**
   * Maximum priority level for priority queue (1-255, recommended: 1-10).
   * Sets x-max-priority argument.
   * Only supported with classic queues.
   */
  maxPriority?: number;
};

/**
 * Options for defining a queue. Uses a discriminated union based on the `type` property
 * to enforce quorum queue constraints at compile time.
 *
 * - Quorum queues (default): Do not support `exclusive` or `maxPriority`
 * - Classic queues: Support all options including `exclusive` and `maxPriority`
 */
export type DefineQueueOptions = QuorumQueueOptions | ClassicQueueOptions;

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
   * The type of the queue.
   *
   * - `quorum`: Quorum queues (default, recommended) - Better durability and high-availability
   * - `classic`: Classic queues - Traditional RabbitMQ queue type
   *
   * Note: Quorum queues require `durable: true` and do not support `exclusive: true`.
   *
   * @default "quorum"
   */
  type?: QueueType;

  /**
   * If true, the queue survives broker restarts. Durable queues are persisted to disk.
   * Note: Quorum queues are always durable regardless of this setting.
   * @default false (but forced to true for quorum queues during setup)
   */
  durable?: boolean;

  /**
   * If true, the queue can only be used by the declaring connection and is deleted when
   * that connection closes. Exclusive queues are private to the connection.
   * Note: Quorum queues do not support exclusive mode.
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
   * Maximum number of delivery attempts before the message is dead-lettered.
   *
   * This is a quorum queue-specific feature. When a message is rejected (nacked)
   * and requeued, RabbitMQ increments the `x-delivery-count` header. When this
   * count reaches the delivery limit, the message is automatically dead-lettered
   * (if DLX is configured) or dropped.
   *
   * Note: This option only applies to quorum queues. For classic queues, you need
   * to implement retry logic at the application level.
   *
   * @minimum 1 - Must be a positive integer (1 or greater)
   *
   * @see https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling
   */
  deliveryLimit?: number;

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
   * Note: The `x-queue-type` argument is automatically set based on the `type` property
   * and should not be specified in this arguments object.
   *
   * Note: The `x-delivery-limit` argument is automatically set based on the `deliveryLimit`
   * property and should not be specified in this arguments object.
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

  /**
   * Retry configuration for message processing failures.
   *
   * This is set by the `defineQueueWithRetry` helper when using TTL-backoff retry mode.
   * The worker uses this configuration to determine retry behavior.
   *
   * - `ttl-backoff`: Uses wait queue pattern with exponential backoff (set by defineQueueWithRetry)
   * - `quorum-native`: Uses RabbitMQ's native delivery limit (set automatically when deliveryLimit is configured)
   *
   * @example
   * ```typescript
   * const { queue } = defineQueueWithRetry("orders", {
   *   deadLetterExchange: dlx,
   *   retry: { maxRetries: 5, initialDelayMs: 2000 },
   * });
   * // queue.retryConfig is automatically populated
   * ```
   */
  retryConfig?: QueueRetryConfig;
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
 * Compression can be optionally applied at publish time by specifying a compression
 * algorithm when calling the publish method.
 *
 * @template TMessage - The message definition with payload schema
 *
 * @example
 * ```typescript
 * const publisher: PublisherDefinition = {
 *   exchange: ordersExchange,
 *   message: orderMessage,
 *   routingKey: 'order.created'
 * };
 * ```
 */
export type PublisherDefinition<TMessage extends MessageDefinition = MessageDefinition> = {
  /** The message definition including the payload schema */
  message: TMessage;
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
