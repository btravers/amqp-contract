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

// =============================================================================
// Retry Configuration Types
// =============================================================================

/**
 * TTL-Backoff retry options for exponential backoff with configurable delays.
 *
 * Uses TTL + wait queue pattern. Messages are published to a wait queue with
 * per-message TTL, then dead-lettered back to the main queue after the TTL expires.
 *
 * **Benefits:** Configurable delays with exponential backoff and jitter.
 * **Limitation:** More complex, potential head-of-queue blocking with mixed TTLs.
 */
export type TtlBackoffRetryOptions = {
  /**
   * TTL-Backoff mode uses wait queues with per-message TTL for exponential backoff.
   */
  mode: "ttl-backoff";
  /**
   * Maximum retry attempts before sending to DLQ.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Initial delay in ms before first retry.
   * @default 1000
   */
  initialDelayMs?: number;
  /**
   * Maximum delay in ms between retries.
   * @default 30000
   */
  maxDelayMs?: number;
  /**
   * Exponential backoff multiplier.
   * @default 2
   */
  backoffMultiplier?: number;
  /**
   * Add jitter to prevent thundering herd.
   * @default true
   */
  jitter?: boolean;
};

/**
 * Quorum-Native retry options using RabbitMQ's native delivery limit feature.
 *
 * Uses quorum queue's `x-delivery-limit` feature. Messages are requeued immediately
 * with `nack(requeue=true)`, and RabbitMQ tracks delivery count via `x-delivery-count`
 * header. When the count exceeds the queue's `deliveryLimit`, the message is
 * automatically dead-lettered.
 *
 * **Benefits:** Simpler architecture, no wait queues needed, no head-of-queue blocking.
 * **Limitation:** Immediate retries only (no exponential backoff).
 *
 * @see https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling
 */
export type QuorumNativeRetryOptions = {
  /**
   * Quorum-Native mode uses RabbitMQ's native delivery limit feature.
   * Requires the queue to be a quorum queue with `deliveryLimit` configured.
   */
  mode: "quorum-native";
};

/**
 * Resolved TTL-Backoff retry options with all defaults applied.
 *
 * This type is used internally in queue definitions after `defineQueue` has applied
 * default values. All fields are required.
 *
 * @internal
 */
export type ResolvedTtlBackoffRetryOptions = {
  mode: "ttl-backoff";
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
};

/**
 * Resolved retry configuration stored in queue definitions.
 *
 * This is a discriminated union based on the `mode` field:
 * - `ttl-backoff`: Has all TTL-backoff options with defaults applied
 * - `quorum-native`: No additional options (uses RabbitMQ native retry)
 */
export type ResolvedRetryOptions = ResolvedTtlBackoffRetryOptions | QuorumNativeRetryOptions;

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
  exclusive?: never;

  /**
   * Quorum queues do not support priority queues.
   * Use type: 'classic' if you need priority queues.
   */
  maxPriority?: never;

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

  /**
   * Retry configuration for handling failed message processing.
   *
   * Determines how the worker handles retries for consumers using this queue:
   * - `"ttl-backoff"` (default): Uses wait queues with exponential backoff
   * - `"quorum-native"`: Uses RabbitMQ's native delivery limit feature
   *
   * When using `"ttl-backoff"` mode, the core package will automatically create
   * a wait queue (`{queueName}-wait`) and the necessary bindings.
   *
   * @example
   * ```typescript
   * // TTL-backoff mode with custom options
   * const orderQueue = defineQueue('order-processing', {
   *   type: 'quorum',
   *   deadLetter: { exchange: dlx },
   *   retry: {
   *     mode: 'ttl-backoff',
   *     maxRetries: 5,
   *     initialDelayMs: 1000,
   *     maxDelayMs: 30000,
   *   },
   * });
   *
   * // Quorum-native mode
   * const orderQueue = defineQueue('order-processing', {
   *   type: 'quorum',
   *   deliveryLimit: 5,
   *   deadLetter: { exchange: dlx },
   *   retry: { mode: 'quorum-native' },
   * });
   * ```
   */
  retry?: TtlBackoffRetryOptions | QuorumNativeRetryOptions;
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

  /**
   * Retry configuration for handling failed message processing.
   *
   * Classic queues only support TTL-backoff retry mode, which uses wait queues
   * with exponential backoff. For quorum-native retry, use quorum queues instead.
   *
   * @example
   * ```typescript
   * const orderQueue = defineQueue('order-processing', {
   *   type: 'classic',
   *   durable: true,
   *   deadLetter: { exchange: dlx },
   *   retry: {
   *     maxRetries: 5,
   *     initialDelayMs: 1000,
   *     maxDelayMs: 30000,
   *   },
   * });
   * ```
   */
  retry?: TtlBackoffRetryOptions;
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
 * Common properties shared by all queue definitions.
 */
type BaseQueueDefinition = {
  /**
   * The name of the queue. Must be unique within the RabbitMQ virtual host.
   */
  name: string;

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
   *
   * When configured, messages that are rejected, expire, or exceed queue limits
   * will be automatically forwarded to the specified dead letter exchange.
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
   */
  arguments?: Record<string, unknown>;
};

/**
 * Definition of a quorum queue.
 *
 * Quorum queues provide better durability and high-availability using the Raft consensus algorithm.
 * They support native retry handling via `deliveryLimit` and both TTL-backoff and quorum-native retry modes.
 */
export type QuorumQueueDefinition = BaseQueueDefinition & {
  /**
   * Queue type discriminator: quorum queue.
   */
  type: "quorum";

  /**
   * Quorum queues do not support exclusive mode.
   * Use type: 'classic' if you need exclusive queues.
   */
  exclusive?: never;

  /**
   * Quorum queues do not support priority queues.
   * Use type: 'classic' if you need priority queues.
   */
  maxPriority?: never;

  /**
   * Maximum number of delivery attempts before the message is dead-lettered.
   *
   * This is a quorum queue-specific feature. When a message is rejected (nacked)
   * and requeued, RabbitMQ increments the `x-delivery-count` header. When this
   * count reaches the delivery limit, the message is automatically dead-lettered
   * (if DLX is configured) or dropped.
   *
   * @minimum 1 - Must be a positive integer (1 or greater)
   *
   * @see https://www.rabbitmq.com/docs/quorum-queues#poison-message-handling
   */
  deliveryLimit?: number;

  /**
   * Retry configuration for handling failed message processing.
   *
   * Quorum queues support both:
   * - `ttl-backoff`: Uses wait queues with exponential backoff (default)
   * - `quorum-native`: Uses RabbitMQ's native delivery limit feature
   *
   * When the queue is created, defaults are applied for TTL-backoff options.
   */
  retry: ResolvedRetryOptions;
};

/**
 * Definition of a classic queue.
 *
 * Classic queues are the traditional RabbitMQ queue type. Use them when you need
 * specific features not supported by quorum queues (e.g., exclusive queues, priority queues).
 */
export type ClassicQueueDefinition = BaseQueueDefinition & {
  /**
   * Queue type discriminator: classic queue.
   */
  type: "classic";

  /**
   * Classic queues do not support delivery limits.
   * Use type: 'quorum' if you need native retry with delivery limits.
   */
  deliveryLimit?: never;

  /**
   * If true, the queue can only be used by the declaring connection and is deleted when
   * that connection closes. Exclusive queues are private to the connection.
   * @default false
   */
  exclusive?: boolean;

  /**
   * Retry configuration for handling failed message processing.
   *
   * Classic queues only support TTL-backoff retry mode (default).
   * When the queue is created, defaults are applied.
   */
  retry: ResolvedTtlBackoffRetryOptions;
};

/**
 * Definition of an AMQP queue.
 *
 * A discriminated union based on queue type:
 * - `QuorumQueueDefinition`: For quorum queues (type: "quorum")
 * - `ClassicQueueDefinition`: For classic queues (type: "classic")
 *
 * Use `queue.type` as the discriminator to narrow the type.
 */
export type QueueDefinition = QuorumQueueDefinition | ClassicQueueDefinition;

/**
 * A queue with automatically generated TTL-backoff retry infrastructure.
 *
 * This type is returned by `defineQueue` when TTL-backoff retry is configured
 * with a dead letter exchange. When passed to `defineContract`, the wait queue
 * and bindings are automatically added to the contract.
 *
 * @example
 * ```typescript
 * const dlx = defineExchange('orders-dlx', 'direct', { durable: true });
 * const queue = defineQueue('order-processing', {
 *   deadLetter: { exchange: dlx },
 *   retry: { mode: 'ttl-backoff', maxRetries: 5 },
 * });
 * // queue is QueueWithTtlBackoffInfrastructure
 *
 * const contract = defineContract({
 *   exchanges: { dlx },
 *   queues: { orderProcessing: queue }, // Automatically adds wait queue
 *   // ... bindings are automatically generated
 * });
 * ```
 */
export type QueueWithTtlBackoffInfrastructure = {
  /**
   * Discriminator to identify this as a queue with TTL-backoff infrastructure.
   * @internal
   */
  __brand: "QueueWithTtlBackoffInfrastructure";

  /**
   * The main queue definition.
   */
  queue: QueueDefinition;

  /**
   * The wait queue for holding messages during backoff delay.
   */
  waitQueue: QueueDefinition;

  /**
   * Binding that routes failed messages to the wait queue.
   */
  waitQueueBinding: QueueBindingDefinition;

  /**
   * Binding that routes retried messages back to the main queue.
   */
  mainQueueRetryBinding: QueueBindingDefinition;
};

/**
 * A queue entry that can be passed to `defineContract`.
 *
 * Can be either a plain queue definition or a queue with TTL-backoff infrastructure.
 */
export type QueueEntry = QueueDefinition | QueueWithTtlBackoffInfrastructure;

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

// =============================================================================
// Event and Command Configuration Types
// =============================================================================

/**
 * Base type for event publisher configuration.
 *
 * This is a simplified type used in ContractDefinition. The full generic type
 * is defined in the builder module.
 *
 * @see defineEventPublisher for creating event publishers
 */
export type EventPublisherConfigBase = {
  __brand: "EventPublisherConfig";
  exchange: ExchangeDefinition;
  message: MessageDefinition;
  routingKey: string | undefined;
  arguments?: Record<string, unknown>;
};

/**
 * Base type for command consumer configuration.
 *
 * This is a simplified type used in ContractDefinition. The full generic type
 * is defined in the builder module.
 *
 * @see defineCommandConsumer for creating command consumers
 */
export type CommandConsumerConfigBase = {
  __brand: "CommandConsumerConfig";
  consumer: ConsumerDefinition;
  binding: QueueBindingDefinition;
  exchange: ExchangeDefinition;
  message: MessageDefinition;
  routingKey: string | undefined;
};

/**
 * Base type for event consumer result.
 *
 * This is a simplified type used in ContractDefinitionInput. The full generic type
 * is defined in the builder module.
 *
 * @see defineEventConsumer for creating event consumers
 */
export type EventConsumerResultBase = {
  __brand: "EventConsumerResult";
  consumer: ConsumerDefinition;
  binding: QueueBindingDefinition;
};

/**
 * Complete AMQP contract definition (output type).
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
   *
   * When a queue has TTL-backoff retry configured, pass the `QueueWithTtlBackoffInfrastructure`
   * object returned by `defineQueue`. The wait queue and bindings will be automatically added.
   */
  queues?: Record<string, QueueEntry>;

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
 * Publisher entry that can be passed to defineContract's publishers section.
 *
 * Can be either:
 * - A plain PublisherDefinition from definePublisher
 * - An EventPublisherConfig from defineEventPublisher (auto-extracted to publisher)
 */
export type PublisherEntry = PublisherDefinition | EventPublisherConfigBase;

/**
 * Consumer entry that can be passed to defineContract's consumers section.
 *
 * Can be either:
 * - A plain ConsumerDefinition from defineConsumer
 * - An EventConsumerResult from defineEventConsumer (binding auto-extracted)
 * - A CommandConsumerConfig from defineCommandConsumer (binding auto-extracted)
 */
export type ConsumerEntry =
  | ConsumerDefinition
  | EventConsumerResultBase
  | CommandConsumerConfigBase;

/**
 * Contract definition input type with automatic extraction of event/command patterns.
 *
 * Users only define publishers and consumers. Exchanges, queues, and bindings are
 * automatically extracted from these definitions.
 *
 * @example
 * ```typescript
 * const contract = defineContract({
 *   publishers: {
 *     // EventPublisherConfig → auto-extracted to publisher
 *     orderCreated: defineEventPublisher(ordersExchange, orderMessage, { routingKey: "order.created" }),
 *   },
 *   consumers: {
 *     // CommandConsumerConfig → auto-extracted to consumer + binding
 *     processOrder: defineCommandConsumer(orderQueue, ordersExchange, orderMessage, { routingKey: "order.process" }),
 *     // EventConsumerResult → auto-extracted to consumer + binding
 *     notify: defineEventConsumer(orderCreatedEvent, notificationQueue),
 *   },
 * });
 * ```
 *
 * @see defineContract - Processes this input and returns a ContractDefinition
 */
export type ContractDefinitionInput = {
  /**
   * Named publisher definitions.
   *
   * Can accept:
   * - PublisherDefinition from definePublisher
   * - EventPublisherConfig from defineEventPublisher (auto-extracted to publisher)
   */
  publishers?: Record<string, PublisherEntry>;

  /**
   * Named consumer definitions.
   *
   * Can accept:
   * - ConsumerDefinition from defineConsumer
   * - EventConsumerResult from defineEventConsumer (binding auto-extracted)
   * - CommandConsumerConfig from defineCommandConsumer (binding auto-extracted)
   */
  consumers?: Record<string, ConsumerEntry>;
};

// =============================================================================
// Contract Output Type Inference Helpers
// =============================================================================

/**
 * Extract the exchange from a publisher entry.
 * @internal
 */
type ExtractPublisherExchange<T extends PublisherEntry> = T extends EventPublisherConfigBase
  ? T["exchange"]
  : T extends PublisherDefinition
    ? T["exchange"]
    : never;

/**
 * Extract the queue from a consumer entry.
 * @internal
 */
type ExtractConsumerQueue<T extends ConsumerEntry> = T extends EventConsumerResultBase
  ? T["consumer"]["queue"]
  : T extends CommandConsumerConfigBase
    ? T["consumer"]["queue"]
    : T extends ConsumerDefinition
      ? T["queue"]
      : never;

/**
 * Extract the exchange from a consumer entry (from binding).
 * @internal
 */
type ExtractConsumerExchange<T extends ConsumerEntry> = T extends EventConsumerResultBase
  ? T["binding"]["exchange"]
  : T extends CommandConsumerConfigBase
    ? T["exchange"]
    : never;

/**
 * Extract the binding from a consumer entry.
 * @internal
 */
type ExtractConsumerBinding<T extends ConsumerEntry> = T extends EventConsumerResultBase
  ? T["binding"]
  : T extends CommandConsumerConfigBase
    ? T["binding"]
    : never;

/**
 * Check if a consumer entry has a binding.
 * @internal
 */
type HasBinding<T extends ConsumerEntry> = T extends EventConsumerResultBase
  ? true
  : T extends CommandConsumerConfigBase
    ? true
    : false;

/**
 * Extract exchanges from all publishers in a contract.
 * @internal
 */
type ExtractExchangesFromPublishers<TPublishers extends Record<string, PublisherEntry>> = {
  [K in keyof TPublishers as ExtractPublisherExchange<
    TPublishers[K]
  >["name"]]: ExtractPublisherExchange<TPublishers[K]>;
};

/**
 * Extract exchanges from all consumers in a contract.
 * @internal
 */
type ExtractExchangesFromConsumers<TConsumers extends Record<string, ConsumerEntry>> = {
  [K in keyof TConsumers as ExtractConsumerExchange<TConsumers[K]> extends ExchangeDefinition
    ? ExtractConsumerExchange<TConsumers[K]>["name"]
    : never]: ExtractConsumerExchange<TConsumers[K]> extends ExchangeDefinition
    ? ExtractConsumerExchange<TConsumers[K]>
    : never;
};

/**
 * Extract queues from all consumers in a contract.
 * @internal
 */
type ExtractQueuesFromConsumers<TConsumers extends Record<string, ConsumerEntry>> = {
  [K in keyof TConsumers as ExtractConsumerQueue<TConsumers[K]>["name"]]: ExtractConsumerQueue<
    TConsumers[K]
  >;
};

/**
 * Extract bindings from all consumers in a contract.
 * @internal
 */
type ExtractBindingsFromConsumers<TConsumers extends Record<string, ConsumerEntry>> = {
  [K in keyof TConsumers as HasBinding<TConsumers[K]> extends true
    ? `${K & string}Binding`
    : never]: ExtractConsumerBinding<TConsumers[K]>;
};

/**
 * Extract the consumer definition from a consumer entry.
 * @internal
 */
type ExtractConsumerDefinition<T extends ConsumerEntry> = T extends EventConsumerResultBase
  ? T["consumer"]
  : T extends CommandConsumerConfigBase
    ? T["consumer"]
    : T extends ConsumerDefinition
      ? T
      : never;

/**
 * Extract consumer definitions from all consumers in a contract.
 * @internal
 */
type ExtractConsumerDefinitions<TConsumers extends Record<string, ConsumerEntry>> = {
  [K in keyof TConsumers]: ExtractConsumerDefinition<TConsumers[K]>;
};

/**
 * Extract the publisher definition from a publisher entry.
 * @internal
 */
type ExtractPublisherDefinition<T extends PublisherEntry> = T extends EventPublisherConfigBase
  ? PublisherDefinition<T["message"]> &
      (T["exchange"] extends FanoutExchangeDefinition
        ? { exchange: T["exchange"]; routingKey?: never }
        : { exchange: T["exchange"]; routingKey: T["routingKey"] & string })
  : T extends PublisherDefinition
    ? T
    : never;

/**
 * Extract publisher definitions from all publishers in a contract.
 * @internal
 */
type ExtractPublisherDefinitions<TPublishers extends Record<string, PublisherEntry>> = {
  [K in keyof TPublishers]: ExtractPublisherDefinition<TPublishers[K]>;
};

/**
 * Contract output type with all resources extracted and properly typed.
 *
 * This type represents the fully expanded contract with:
 * - exchanges: Extracted from publishers and consumer bindings
 * - queues: Extracted from consumers
 * - bindings: Extracted from event/command consumers
 * - publishers: Normalized publisher definitions
 * - consumers: Normalized consumer definitions
 */
export type ContractOutput<TContract extends ContractDefinitionInput> = {
  exchanges: (TContract["publishers"] extends Record<string, PublisherEntry>
    ? ExtractExchangesFromPublishers<TContract["publishers"]>
    : {}) &
    (TContract["consumers"] extends Record<string, ConsumerEntry>
      ? ExtractExchangesFromConsumers<TContract["consumers"]>
      : {});
  queues: TContract["consumers"] extends Record<string, ConsumerEntry>
    ? ExtractQueuesFromConsumers<TContract["consumers"]>
    : {};
  bindings: TContract["consumers"] extends Record<string, ConsumerEntry>
    ? ExtractBindingsFromConsumers<TContract["consumers"]>
    : {};
  publishers: TContract["publishers"] extends Record<string, PublisherEntry>
    ? ExtractPublisherDefinitions<TContract["publishers"]>
    : {};
  consumers: TContract["consumers"] extends Record<string, ConsumerEntry>
    ? ExtractConsumerDefinitions<TContract["consumers"]>
    : {};
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
