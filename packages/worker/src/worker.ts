import {
  AmqpClient,
  type Logger,
  TechnicalError,
  type TelemetryProvider,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  recordConsumeMetric,
  startConsumeSpan,
} from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { Channel, ConsumeMessage } from "amqplib";
import {
  type ConsumerDefinition,
  type ContractDefinition,
  type InferConsumerNames,
  type ResolvedRetryOptions,
  type ResolvedTtlBackoffRetryOptions,
  extractConsumer,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, NonRetryableError } from "./errors.js";
import type {
  WorkerInferConsumedMessage,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlers,
} from "./types.js";
import type { HandlerError } from "./errors.js";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { decompressBuffer } from "./decompression.js";

/**
 * Internal type for consumer options extracted from handler tuples.
 * Not exported - options are specified inline in the handler tuple types.
 *
 * Note: Retry configuration is now defined at the queue level in the contract,
 * not at the handler level. See `QueueDefinition.retry` for configuration options.
 */
type ConsumerOptions = {
  /** Number of messages to prefetch */
  prefetch?: number;
};

/**
 * Retry configuration from the contract with all values resolved.
 * This is a discriminated union on `mode` - TTL-backoff has the config fields,
 * quorum-native does not.
 */
type ResolvedRetryConfig = ResolvedRetryOptions;

/**
 * Type guard to check if a handler entry is a tuple format [handler, options].
 */
function isHandlerTuple(entry: unknown): entry is [unknown, ConsumerOptions] {
  return Array.isArray(entry) && entry.length === 2;
}

/**
 * Options for creating a type-safe AMQP worker.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * const options: CreateWorkerOptions<typeof contract> = {
 *   contract: myContract,
 *   handlers: {
 *     // Simple handler
 *     processOrder: ({ payload }) => {
 *       console.log('Processing order:', payload.orderId);
 *       return Future.value(Result.Ok(undefined));
 *     },
 *     // Handler with prefetch configuration
 *     processPayment: [
 *       ({ payload }) => {
 *         console.log('Processing payment:', payload.paymentId);
 *         return Future.value(Result.Ok(undefined));
 *       },
 *       { prefetch: 10 }
 *     ]
 *   },
 *   urls: ['amqp://localhost'],
 *   connectionOptions: {
 *     heartbeatIntervalInSeconds: 30
 *   },
 *   logger: myLogger
 * };
 * ```
 *
 * Note: Retry configuration is defined at the queue level in the contract,
 * not at the handler level. See `QueueDefinition.retry` for configuration options.
 */
export type CreateWorkerOptions<TContract extends ContractDefinition> = {
  /** The AMQP contract definition specifying consumers and their message schemas */
  contract: TContract;
  /**
   * Handlers for each consumer defined in the contract.
   * Handlers must return `Future<Result<void, HandlerError>>` for explicit error handling.
   * Use defineHandler() to create handlers.
   */
  handlers: WorkerInferConsumerHandlers<TContract>;
  /** AMQP broker URL(s). Multiple URLs provide failover support */
  urls: ConnectionUrl[];
  /** Optional connection configuration (heartbeat, reconnect settings, etc.) */
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  /** Optional logger for logging message consumption and errors */
  logger?: Logger | undefined;
  /**
   * Optional telemetry provider for tracing and metrics.
   * If not provided, uses the default provider which attempts to load OpenTelemetry.
   * OpenTelemetry instrumentation is automatically enabled if @opentelemetry/api is installed.
   */
  telemetry?: TelemetryProvider | undefined;
};

/**
 * Type-safe AMQP worker for consuming messages from RabbitMQ.
 *
 * This class provides automatic message validation, connection management,
 * and error handling for consuming messages based on a contract definition.
 *
 * @typeParam TContract - The contract definition type
 *
 * @example
 * ```typescript
 * import { TypedAmqpWorker } from '@amqp-contract/worker';
 * import { z } from 'zod';
 *
 * const contract = defineContract({
 *   queues: {
 *     orderProcessing: defineQueue('order-processing', { durable: true })
 *   },
 *   consumers: {
 *     processOrder: defineConsumer('order-processing', z.object({
 *       orderId: z.string(),
 *       amount: z.number()
 *     }))
 *   }
 * });
 *
 * const worker = await TypedAmqpWorker.create({
 *   contract,
 *   handlers: {
 *     processOrder: async (message) => {
 *       console.log('Processing order', message.orderId);
 *       // Process the order...
 *     }
 *   },
 *   urls: ['amqp://localhost']
 * }).resultToPromise();
 *
 * // Close when done
 * await worker.close().resultToPromise();
 * ```
 */
export class TypedAmqpWorker<TContract extends ContractDefinition> {
  /**
   * Internal handler storage - handlers returning `Future<Result>`.
   */
  private readonly actualHandlers: Partial<
    Record<
      InferConsumerNames<TContract>,
      WorkerInferConsumerHandler<TContract, InferConsumerNames<TContract>>
    >
  >;
  private readonly consumerOptions: Partial<Record<InferConsumerNames<TContract>, ConsumerOptions>>;
  private readonly consumerTags: Set<string> = new Set();
  private readonly telemetry: TelemetryProvider;

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly logger?: Logger,
    telemetry?: TelemetryProvider,
  ) {
    this.telemetry = telemetry ?? defaultTelemetryProvider;

    // Extract handlers and options from the handlers object
    this.actualHandlers = {};
    this.consumerOptions = {};

    // Cast handlers to a generic record for iteration
    const handlersRecord = handlers as Record<string, unknown>;

    for (const consumerName of Object.keys(handlersRecord)) {
      const handlerEntry = handlersRecord[consumerName];
      const typedConsumerName = consumerName as InferConsumerNames<TContract>;

      if (isHandlerTuple(handlerEntry)) {
        // Tuple format: [handler, options]
        const [handler, options] = handlerEntry;
        this.actualHandlers[typedConsumerName] = handler as WorkerInferConsumerHandler<
          TContract,
          InferConsumerNames<TContract>
        >;
        this.consumerOptions[typedConsumerName] = options;
      } else {
        // Direct function format
        this.actualHandlers[typedConsumerName] = handlerEntry as WorkerInferConsumerHandler<
          TContract,
          InferConsumerNames<TContract>
        >;
      }
    }
  }

  /**
   * Create a type-safe AMQP worker from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The worker will set up
   * consumers for all contract-defined handlers asynchronously in the background
   * once the underlying connection and channels are ready.
   *
   * Connections are automatically shared across clients and workers with the same
   * URLs and connection options, following RabbitMQ best practices.
   *
   * @param options - Configuration options for the worker
   * @returns A Future that resolves to a Result containing the worker or an error
   *
   * @example
   * ```typescript
   * const worker = await TypedAmqpWorker.create({
   *   contract: myContract,
   *   handlers: {
   *     processOrder: async ({ payload }) => console.log('Order:', payload.orderId)
   *   },
   *   urls: ['amqp://localhost']
   * }).resultToPromise();
   * ```
   */
  static create<TContract extends ContractDefinition>({
    contract,
    handlers,
    urls,
    connectionOptions,
    logger,
    telemetry,
  }: CreateWorkerOptions<TContract>): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>> {
    const worker = new TypedAmqpWorker(
      contract,
      new AmqpClient(contract, {
        urls,
        connectionOptions,
      }),
      handlers,
      logger,
      telemetry,
    );

    // Note: Wait queues are now created by the core package in setupAmqpTopology
    // when the queue's retry mode is "ttl-backoff"
    return worker
      .waitForConnectionReady()
      .flatMapOk(() => worker.consumeAll())
      .mapOk(() => worker);
  }

  /**
   * Close the AMQP channel and connection.
   *
   * This gracefully closes the connection to the AMQP broker,
   * stopping all message consumption and cleaning up resources.
   *
   * @returns A Future that resolves to a Result indicating success or failure
   *
   * @example
   * ```typescript
   * const closeResult = await worker.close().resultToPromise();
   * if (closeResult.isOk()) {
   *   console.log('Worker closed successfully');
   * }
   * ```
   */
  close(): Future<Result<void, TechnicalError>> {
    return Future.all(
      Array.from(this.consumerTags).map((consumerTag) =>
        this.amqpClient.cancel(consumerTag).mapErrorToResult((error) => {
          this.logger?.warn("Failed to cancel consumer during close", { consumerTag, error });
          return Result.Ok(undefined);
        }),
      ),
    )
      .map(Result.all)
      .tapOk(() => {
        // Clear consumer tags after successful cancellation
        this.consumerTags.clear();
      })
      .flatMapOk(() => this.amqpClient.close())
      .mapOk(() => undefined);
  }

  /**
   * Get the retry configuration for a consumer's queue.
   * Defaults are applied in the contract's defineQueue, so we just return the config.
   */
  private getRetryConfigForConsumer(consumer: ConsumerDefinition): ResolvedRetryConfig {
    return consumer.queue.retry;
  }

  /**
   * Start consuming messages for all consumers.
   * TypeScript guarantees consumers exist (handlers require matching consumers).
   */
  private consumeAll(): Future<Result<void, TechnicalError>> {
    const consumers = this.contract.consumers!;
    const consumerNames = Object.keys(consumers) as InferConsumerNames<TContract>[];

    // Calculate max prefetch (AMQP 0.9.1 prefetch is per-channel)
    const maxPrefetch = consumerNames.reduce((max, name) => {
      const prefetch = this.consumerOptions[name]?.prefetch;
      return prefetch ? Math.max(max, prefetch) : max;
    }, 0);

    if (maxPrefetch > 0) {
      this.amqpClient.addSetup(async (channel: Channel) => {
        await channel.prefetch(maxPrefetch);
      });
    }

    return Future.all(consumerNames.map((name) => this.consume(name)))
      .map(Result.all)
      .mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return this.amqpClient.waitForConnect();
  }

  /**
   * Start consuming messages for a specific consumer.
   * TypeScript guarantees consumer and handler exist for valid consumer names.
   */
  private consume<TName extends InferConsumerNames<TContract>>(
    consumerName: TName,
  ): Future<Result<void, TechnicalError>> {
    // Non-null assertions safe: TypeScript guarantees these exist for valid TName
    const consumerEntry = this.contract.consumers![consumerName as string]!;
    const consumer = extractConsumer(consumerEntry);
    const handler = this.actualHandlers[consumerName]!;

    return this.consumeSingle(
      consumerName,
      consumer,
      handler as Parameters<typeof this.consumeSingle<TName>>[2],
    );
  }

  /**
   * Validate data against a Standard Schema and handle errors.
   */
  private validateSchema(
    schema: StandardSchemaV1,
    data: unknown,
    context: { consumerName: string; queueName: string; field: string },
    msg: ConsumeMessage,
  ): Future<Result<unknown, TechnicalError>> {
    const rawValidation = schema["~standard"].validate(data);
    const validationPromise =
      rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation);

    return Future.fromPromise(validationPromise)
      .mapError((error) => new TechnicalError(`Error validating ${context.field}`, error))
      .mapOkToResult((result) => {
        if (result.issues) {
          return Result.Error(
            new TechnicalError(
              `${context.field} validation failed`,
              new MessageValidationError(context.consumerName, result.issues),
            ),
          );
        }
        return Result.Ok(result.value);
      })
      .tapError((error) => {
        this.logger?.error(`${context.field} validation failed`, {
          consumerName: context.consumerName,
          queueName: context.queueName,
          error,
        });
        this.amqpClient.nack(msg, false, false);
      });
  }

  /**
   * Parse and validate a message from AMQP.
   * @returns Ok with validated message (payload + headers), or Error (message already nacked)
   */
  private parseAndValidateMessage<TName extends InferConsumerNames<TContract>>(
    msg: ConsumeMessage,
    consumer: ConsumerDefinition,
    consumerName: TName,
  ): Future<Result<WorkerInferConsumedMessage<TContract, TName>, TechnicalError>> {
    const context = {
      consumerName: String(consumerName),
      queueName: consumer.queue.name,
    };

    const nackAndError = (message: string, error?: unknown): TechnicalError => {
      this.logger?.error(message, { ...context, error });
      this.amqpClient.nack(msg, false, false);
      return new TechnicalError(message, error);
    };

    // Decompress → Parse JSON → Validate payload
    const parsePayload = decompressBuffer(msg.content, msg.properties.contentEncoding)
      .tapError((error) => {
        this.logger?.error("Failed to decompress message", { ...context, error });
        this.amqpClient.nack(msg, false, false);
      })
      .mapOkToResult((buffer) =>
        Result.fromExecution(() => JSON.parse(buffer.toString()) as unknown).mapError((error) =>
          nackAndError("Failed to parse JSON", error),
        ),
      )
      .flatMapOk((parsed) =>
        this.validateSchema(
          consumer.message.payload as StandardSchemaV1,
          parsed,
          { ...context, field: "payload" },
          msg,
        ),
      );

    // Validate headers (if schema defined)
    const parseHeaders = consumer.message.headers
      ? this.validateSchema(
          consumer.message.headers as StandardSchemaV1,
          msg.properties.headers ?? {},
          { ...context, field: "headers" },
          msg,
        )
      : Future.value(Result.Ok<unknown, TechnicalError>(undefined));

    return Future.allFromDict({ payload: parsePayload, headers: parseHeaders }).map(
      Result.allFromDict,
    ) as Future<Result<WorkerInferConsumedMessage<TContract, TName>, TechnicalError>>;
  }

  /**
   * Consume messages one at a time
   */
  private consumeSingle<TName extends InferConsumerNames<TContract>>(
    consumerName: TName,
    consumer: ConsumerDefinition,
    handler: (
      message: WorkerInferConsumedMessage<TContract, TName>,
      rawMessage: ConsumeMessage,
    ) => Future<Result<void, HandlerError>>,
  ): Future<Result<void, TechnicalError>> {
    const queueName = consumer.queue.name;

    // Start consuming
    return this.amqpClient
      .consume(queueName, async (msg) => {
        // Handle null messages (consumer cancellation)
        if (msg === null) {
          this.logger?.warn("Consumer cancelled by server", {
            consumerName: String(consumerName),
            queueName,
          });
          return;
        }

        const startTime = Date.now();
        const span = startConsumeSpan(this.telemetry, queueName, String(consumerName), {
          "messaging.rabbitmq.message.delivery_tag": msg.fields.deliveryTag,
        });

        // Parse and validate message
        await this.parseAndValidateMessage(msg, consumer, consumerName)
          .flatMapOk((validatedMessage) =>
            handler(validatedMessage, msg)
              .flatMapOk(() => {
                this.logger?.info("Message consumed successfully", {
                  consumerName: String(consumerName),
                  queueName,
                });
                // Acknowledge message on success
                this.amqpClient.ack(msg);

                // Record telemetry success
                const durationMs = Date.now() - startTime;
                endSpanSuccess(span);
                recordConsumeMetric(
                  this.telemetry,
                  queueName,
                  String(consumerName),
                  true,
                  durationMs,
                );

                return Future.value(Result.Ok<void, HandlerError>(undefined));
              })
              .flatMapError((handlerError: HandlerError) => {
                // Handler returned an error
                this.logger?.error("Error processing message", {
                  consumerName: String(consumerName),
                  queueName,
                  errorType: handlerError.name,
                  error: handlerError.message,
                });

                // Record telemetry failure
                const durationMs = Date.now() - startTime;
                endSpanError(span, handlerError);
                recordConsumeMetric(
                  this.telemetry,
                  queueName,
                  String(consumerName),
                  false,
                  durationMs,
                );

                // Handle the error using retry mechanism
                return this.handleError(handlerError, msg, String(consumerName), consumer);
              }),
          )
          .tapError(() => {
            // Record telemetry failure for validation errors
            // Note: The actual validation error is logged in parseAndValidateMessage,
            // here we just record that validation failed for telemetry purposes
            const durationMs = Date.now() - startTime;
            endSpanError(span, new Error("Message validation failed"));
            recordConsumeMetric(this.telemetry, queueName, String(consumerName), false, durationMs);
          })
          .toPromise();
      })
      .tapOk((consumerTag) => {
        // Store consumer tag for later cancellation
        this.consumerTags.add(consumerTag);
      })
      .mapError(
        (error) =>
          new TechnicalError(`Failed to start consuming for "${String(consumerName)}"`, error),
      )
      .mapOk(() => undefined);
  }

  /**
   * Handle error in message processing with retry logic.
   *
   * Flow depends on retry mode:
   *
   * **quorum-native mode:**
   * 1. If NonRetryableError -> send directly to DLQ (no retry)
   * 2. Otherwise -> nack with requeue=true (RabbitMQ handles delivery count)
   *
   * **ttl-backoff mode:**
   * 1. If NonRetryableError -> send directly to DLQ (no retry)
   * 2. If max retries exceeded -> send to DLQ
   * 3. Otherwise -> publish to wait queue with TTL for retry
   *
   * **Legacy mode (no retry config):**
   * 1. nack with requeue=true (immediate requeue)
   */
  private handleError(
    error: Error,
    msg: ConsumeMessage,
    consumerName: string,
    consumer: ConsumerDefinition,
  ): Future<Result<void, TechnicalError>> {
    // NonRetryableError -> send directly to DLQ without retrying
    if (error instanceof NonRetryableError) {
      this.logger?.error("Non-retryable error, sending to DLQ immediately", {
        consumerName,
        errorType: error.name,
        error: error.message,
      });
      this.sendToDLQ(msg, consumer);
      return Future.value(Result.Ok(undefined));
    }

    // Get retry config from the queue definition in the contract
    const config = this.getRetryConfigForConsumer(consumer);

    // Quorum-native mode: let RabbitMQ handle retry via x-delivery-count
    if (config.mode === "quorum-native") {
      return this.handleErrorQuorumNative(error, msg, consumerName, consumer);
    }

    // TTL-backoff mode: use wait queue with exponential backoff
    return this.handleErrorTtlBackoff(error, msg, consumerName, consumer, config);
  }

  /**
   * Handle error using quorum queue's native delivery limit feature.
   *
   * Simply requeues the message with nack(requeue=true). RabbitMQ automatically:
   * - Increments x-delivery-count header
   * - Dead-letters the message when count exceeds x-delivery-limit
   *
   * This is simpler than TTL-based retry but provides immediate retries only.
   */
  private handleErrorQuorumNative(
    error: Error,
    msg: ConsumeMessage,
    consumerName: string,
    consumer: ConsumerDefinition,
  ): Future<Result<void, TechnicalError>> {
    const queue = consumer.queue;
    const queueName = queue.name;
    // x-delivery-count is incremented on each delivery attempt
    // When x-delivery-count equals x-delivery-limit, message is dead-lettered on next attempt
    const deliveryCount = (msg.properties.headers?.["x-delivery-count"] as number) ?? 0;
    // This function is only called for quorum-native mode, which requires quorum queues
    const deliveryLimit = queue.type === "quorum" ? queue.deliveryLimit : undefined;

    // After this requeue, RabbitMQ will increment deliveryCount
    // Message is dead-lettered when deliveryCount reaches deliveryLimit
    // So if deliveryCount == deliveryLimit - 1, the next failure will dead-letter the message
    const attemptsBeforeDeadLetter =
      deliveryLimit !== undefined ? Math.max(0, deliveryLimit - deliveryCount - 1) : "unknown";

    // Log warning if this is the last attempt before dead-lettering
    if (deliveryLimit !== undefined && deliveryCount >= deliveryLimit - 1) {
      this.logger?.warn("Message at final delivery attempt (quorum-native mode)", {
        consumerName,
        queueName,
        deliveryCount,
        deliveryLimit,
        willDeadLetterOnNextFailure: deliveryCount === deliveryLimit - 1,
        alreadyExceededLimit: deliveryCount >= deliveryLimit,
        error: error.message,
      });
    } else {
      this.logger?.warn("Retrying message (quorum-native mode)", {
        consumerName,
        queueName,
        deliveryCount,
        deliveryLimit,
        attemptsBeforeDeadLetter,
        error: error.message,
      });
    }

    // Requeue the message - RabbitMQ tracks delivery count and handles dead-lettering
    this.amqpClient.nack(msg, false, true);
    return Future.value(Result.Ok(undefined));
  }

  /**
   * Handle error using TTL + wait queue pattern for exponential backoff.
   */
  private handleErrorTtlBackoff(
    error: Error,
    msg: ConsumeMessage,
    consumerName: string,
    consumer: ConsumerDefinition,
    config: ResolvedTtlBackoffRetryOptions,
  ): Future<Result<void, TechnicalError>> {
    // Get retry count from headers
    const retryCount = (msg.properties.headers?.["x-retry-count"] as number) ?? 0;

    // Max retries exceeded -> DLQ
    if (retryCount >= config.maxRetries) {
      this.logger?.error("Max retries exceeded, sending to DLQ", {
        consumerName,
        retryCount,
        maxRetries: config.maxRetries,
        error: error.message,
      });
      this.sendToDLQ(msg, consumer);
      return Future.value(Result.Ok(undefined));
    }

    // Retry with exponential backoff
    const delayMs = this.calculateRetryDelay(retryCount, config);
    this.logger?.warn("Retrying message (ttl-backoff mode)", {
      consumerName,
      retryCount: retryCount + 1,
      delayMs,
      error: error.message,
    });

    return this.publishForRetry(msg, consumer, retryCount + 1, delayMs, error);
  }

  /**
   * Calculate retry delay with exponential backoff and optional jitter.
   */
  private calculateRetryDelay(retryCount: number, config: ResolvedTtlBackoffRetryOptions): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier, jitter } = config;

    let delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, retryCount), maxDelayMs);

    if (jitter) {
      // Add jitter: random value between 50% and 100% of calculated delay
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Parse message content for republishing.
   * Prevents double JSON serialization by converting Buffer to object when possible.
   */
  private parseMessageContentForRetry(msg: ConsumeMessage, queueName: string): Buffer | unknown {
    let content: Buffer | unknown = msg.content;

    // If message is not compressed (no contentEncoding), parse it to get the original object
    if (!msg.properties.contentEncoding) {
      try {
        content = JSON.parse(msg.content.toString());
      } catch (err) {
        this.logger?.warn("Failed to parse message for retry, using original buffer", {
          queueName,
          error: err,
        });
      }
    }

    return content;
  }

  /**
   * Publish message to wait queue for retry after TTL expires.
   *
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ Retry Flow (Native RabbitMQ TTL + DLX Pattern)                   │
   * ├─────────────────────────────────────────────────────────────────┤
   * │                                                                   │
   * │ 1. Handler throws any Error                                      │
   * │    ↓                                                              │
   * │ 2. Worker publishes to DLX with routing key: {queue}-wait        │
   * │    ↓                                                              │
   * │ 3. DLX routes to wait queue: {queue}-wait                        │
   * │    (with expiration: calculated backoff delay)                   │
   * │    ↓                                                              │
   * │ 4. Message waits in queue until TTL expires                      │
   * │    ↓                                                              │
   * │ 5. Expired message dead-lettered to DLX                          │
   * │    (with routing key: {queue})                                   │
   * │    ↓                                                              │
   * │ 6. DLX routes back to main queue → RETRY                         │
   * │    ↓                                                              │
   * │ 7. If retries exhausted: nack without requeue → DLQ              │
   * │                                                                   │
   * └─────────────────────────────────────────────────────────────────┘
   */
  private publishForRetry(
    msg: ConsumeMessage,
    consumer: ConsumerDefinition,
    newRetryCount: number,
    delayMs: number,
    error: Error,
  ): Future<Result<void, TechnicalError>> {
    const queueName = consumer.queue.name;
    const deadLetter = consumer.queue.deadLetter;

    if (!deadLetter) {
      this.logger?.warn(
        "Cannot retry: queue does not have DLX configured, falling back to nack with requeue",
        {
          queueName,
        },
      );
      this.amqpClient.nack(msg, false, true);
      return Future.value(Result.Ok(undefined));
    }

    const dlxName = deadLetter.exchange.name;
    const waitRoutingKey = `${queueName}-wait`;

    // Acknowledge original message
    this.amqpClient.ack(msg);

    const content = this.parseMessageContentForRetry(msg, queueName);

    // Publish to DLX with wait routing key
    return this.amqpClient
      .publish(dlxName, waitRoutingKey, content, {
        ...msg.properties,
        expiration: delayMs.toString(), // Per-message TTL
        headers: {
          ...msg.properties.headers,
          "x-retry-count": newRetryCount,
          "x-last-error": error.message,
          "x-first-failure-timestamp":
            msg.properties.headers?.["x-first-failure-timestamp"] ?? Date.now(),
        },
      })
      .mapOkToResult((published) => {
        if (!published) {
          this.logger?.error("Failed to publish message for retry (write buffer full)", {
            queueName,
            waitRoutingKey,
            retryCount: newRetryCount,
          });
          return Result.Error(
            new TechnicalError("Failed to publish message for retry (write buffer full)"),
          );
        }

        this.logger?.info("Message published for retry", {
          queueName,
          waitRoutingKey,
          retryCount: newRetryCount,
          delayMs,
        });
        return Result.Ok(undefined);
      });
  }

  /**
   * Send message to dead letter queue.
   * Nacks the message without requeue, relying on DLX configuration.
   */
  private sendToDLQ(msg: ConsumeMessage, consumer: ConsumerDefinition): void {
    const queueName = consumer.queue.name;
    const hasDeadLetter = consumer.queue.deadLetter !== undefined;

    if (!hasDeadLetter) {
      this.logger?.warn("Queue does not have DLX configured - message will be lost on nack", {
        queueName,
      });
    }

    this.logger?.info("Sending message to DLQ", {
      queueName,
      deliveryTag: msg.fields.deliveryTag,
    });

    // Nack without requeue - relies on DLX configuration
    this.amqpClient.nack(msg, false, false);
  }
}
