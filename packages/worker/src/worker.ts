import {
  AmqpClient,
  type Logger,
  type TelemetryProvider,
  defaultTelemetryProvider,
  endSpanError,
  endSpanSuccess,
  recordConsumeMetric,
  startConsumeSpan,
} from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { Channel, ConsumeMessage, Message } from "amqplib";
import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, NonRetryableError, TechnicalError } from "./errors.js";
import type {
  RetryMode,
  RetryOptions,
  WorkerInferConsumedMessage,
  WorkerInferSafeConsumerBatchHandler,
  WorkerInferSafeConsumerHandler,
  WorkerInferSafeConsumerHandlers,
} from "./types.js";
import type { HandlerError } from "./errors.js";
import { decompressBuffer } from "./decompression.js";

/**
 * Internal type for consumer options extracted from handler tuples.
 * Not exported - options are specified inline in the handler tuple types.
 * Uses discriminated union to enforce mutual exclusivity:
 * - Prefetch-only mode: Cannot have batchSize or batchTimeout
 * - Batch mode: Requires batchSize, allows batchTimeout and prefetch
 * Both modes support optional retry configuration.
 */
type ConsumerOptions =
  | {
      /** Prefetch-based processing (no batching) */
      prefetch?: number;
      batchSize?: never;
      batchTimeout?: never;
      /** Retry configuration for this consumer */
      retry?: RetryOptions;
    }
  | {
      /** Batch-based processing */
      prefetch?: number;
      batchSize: number;
      batchTimeout?: number;
      /** Retry configuration for this consumer */
      retry?: RetryOptions;
    };

/**
 * Internal retry configuration with all values resolved.
 */
type ResolvedRetryConfig = {
  mode: RetryMode;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
};

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
 *     // Simple handler (uses default retry configuration)
 *     processOrder: async (message) => {
 *       console.log('Processing order:', message.orderId);
 *     },
 *     // Handler with prefetch and retry configuration
 *     processPayment: [
 *       async (message) => {
 *         console.log('Processing payment:', message.paymentId);
 *       },
 *       {
 *         prefetch: 10,
 *         retry: {
 *           maxRetries: 3,
 *           initialDelayMs: 1000,
 *           maxDelayMs: 30000,
 *           backoffMultiplier: 2,
 *           jitter: true
 *         }
 *       }
 *     ],
 *     // Handler with batch processing and retry
 *     processNotifications: [
 *       async (messages) => {
 *         console.log('Processing batch:', messages.length);
 *       },
 *       {
 *         batchSize: 5,
 *         batchTimeout: 1000,
 *         retry: { mode: 'quorum-native' }
 *       }
 *     ]
 *   },
 *   urls: ['amqp://localhost'],
 *   connectionOptions: {
 *     heartbeatIntervalInSeconds: 30
 *   },
 *   logger: myLogger
 * };
 * ```
 */
export type CreateWorkerOptions<TContract extends ContractDefinition> = {
  /** The AMQP contract definition specifying consumers and their message schemas */
  contract: TContract;
  /**
   * Handlers for each consumer defined in the contract.
   * Handlers must return `Future<Result<void, HandlerError>>` for explicit error handling.
   * Use defineHandler() to create safe handlers, or defineUnsafeHandler() which wraps
   * Promise-based handlers into safe handlers internally.
   *
   * Retry configuration is specified per consumer via handler options.
   */
  handlers: WorkerInferSafeConsumerHandlers<TContract>;
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
   * Internal handler type - always safe handlers (`Future<Result>`).
   * Unsafe handlers are wrapped into safe handlers by defineUnsafeHandler/defineUnsafeHandlers.
   */
  private readonly actualHandlers: Partial<
    Record<
      InferConsumerNames<TContract>,
      | WorkerInferSafeConsumerHandler<TContract, InferConsumerNames<TContract>>
      | WorkerInferSafeConsumerBatchHandler<TContract, InferConsumerNames<TContract>>
    >
  >;
  private readonly consumerOptions: Partial<Record<InferConsumerNames<TContract>, ConsumerOptions>>;
  private readonly batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly consumerTags: Set<string> = new Set();
  private readonly telemetry: TelemetryProvider;

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    handlers: WorkerInferSafeConsumerHandlers<TContract>,
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

      if (Array.isArray(handlerEntry)) {
        // Tuple format: [handler, options]
        this.actualHandlers[typedConsumerName] = handlerEntry[0] as
          | WorkerInferSafeConsumerHandler<TContract, InferConsumerNames<TContract>>
          | WorkerInferSafeConsumerBatchHandler<TContract, InferConsumerNames<TContract>>;
        this.consumerOptions[typedConsumerName] = handlerEntry[1] as ConsumerOptions;
      } else {
        // Direct function format
        this.actualHandlers[typedConsumerName] = handlerEntry as
          | WorkerInferSafeConsumerHandler<TContract, InferConsumerNames<TContract>>
          | WorkerInferSafeConsumerBatchHandler<TContract, InferConsumerNames<TContract>>;
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
   *     processOrder: async (msg) => console.log('Order:', msg.orderId)
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

    return worker
      .waitForConnectionReady()
      .flatMapOk(() => worker.setupWaitQueues())
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
    // Clear all pending batch timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    return Future.all(
      Array.from(this.consumerTags).map((consumerTag) =>
        Future.fromPromise(this.amqpClient.channel.cancel(consumerTag)).mapErrorToResult(
          (error) => {
            this.logger?.warn("Failed to cancel consumer during close", { consumerTag, error });
            return Result.Ok(undefined);
          },
        ),
      ),
    )
      .map(Result.all)
      .tapOk(() => {
        // Clear consumer tags after successful cancellation
        this.consumerTags.clear();
      })
      .flatMapOk(() => Future.fromPromise(this.amqpClient.close()))
      .mapError((error) => new TechnicalError("Failed to close AMQP connection", error))
      .mapOk(() => undefined);
  }

  /**
   * Set up wait queues for retry mechanism.
   * Creates and binds wait queues for each consumer queue that has DLX configuration
   * and uses "ttl-backoff" retry mode (the default).
   */
  private setupWaitQueues(): Future<Result<void, TechnicalError>> {
    if (!this.contract.consumers || !this.contract.queues) {
      return Future.value(Result.Ok(undefined));
    }

    const setupTasks: Array<Future<Result<void, TechnicalError>>> = [];

    for (const consumerName of Object.keys(
      this.contract.consumers,
    ) as InferConsumerNames<TContract>[]) {
      const consumer = this.contract.consumers[consumerName as string];
      if (!consumer) continue;

      // Get consumer-specific retry config (with defaults)
      const options = this.consumerOptions[consumerName] ?? {};
      const retryOptions = options.retry ?? {};

      // Resolve retry config with defaults
      const retryConfig = this.resolveRetryConfig(retryOptions);

      // For quorum-native mode, validate queue configuration and skip wait queue setup
      if (retryConfig.mode === "quorum-native") {
        const validationError = this.validateQuorumNativeConfigForConsumer(
          String(consumerName),
          consumer,
        );
        if (validationError) {
          return Future.value(Result.Error(validationError));
        }
        this.logger?.info("Using quorum-native retry mode - no wait queue needed", {
          consumerName: String(consumerName),
        });
        continue;
      }

      const queue = consumer.queue;
      const deadLetter = queue.deadLetter;

      // Only create wait queues for queues with DLX configuration
      if (!deadLetter) continue;

      const queueName = queue.name;
      const waitQueueName = `${queueName}-wait`;
      const dlxName = deadLetter.exchange.name;

      const setupTask = Future.fromPromise(
        this.amqpClient.channel.addSetup(async (channel: Channel) => {
          // Create wait queue with DLX pointing back to the main queue
          await channel.assertQueue(waitQueueName, {
            durable: queue.durable ?? false,
            deadLetterExchange: dlxName,
            deadLetterRoutingKey: queueName,
          });

          // Bind wait queue to DLX with routing key pattern
          await channel.bindQueue(waitQueueName, dlxName, `${queueName}-wait`);

          // Bind main queue to DLX for routing retried messages back
          await channel.bindQueue(queueName, dlxName, queueName);

          this.logger?.info("Wait queue created and bound", {
            consumerName: String(consumerName),
            queueName,
            waitQueueName,
            dlxName,
          });
        }),
      ).mapError(
        (error) =>
          new TechnicalError(`Failed to setup wait queue for "${String(consumerName)}"`, error),
      );

      setupTasks.push(setupTask);
    }

    if (setupTasks.length === 0) {
      return Future.value(Result.Ok(undefined));
    }

    return Future.all(setupTasks)
      .map(Result.all)
      .mapOk(() => undefined);
  }

  /**
   * Resolve retry options to a complete configuration with defaults.
   */
  private resolveRetryConfig(retryOptions: RetryOptions): ResolvedRetryConfig {
    // For quorum-native mode, TTL-backoff options are not used
    // but we still provide defaults for internal consistency
    if (retryOptions.mode === "quorum-native") {
      return {
        mode: "quorum-native",
        maxRetries: 0, // Not used in quorum-native mode
        initialDelayMs: 0, // Not used in quorum-native mode
        maxDelayMs: 0, // Not used in quorum-native mode
        backoffMultiplier: 0, // Not used in quorum-native mode
        jitter: false, // Not used in quorum-native mode
      };
    }

    // TTL-backoff mode (default): extract options with defaults
    // At this point, TypeScript knows retryOptions is TtlBackoffRetryOptions
    return {
      mode: "ttl-backoff",
      maxRetries: retryOptions.maxRetries ?? 3,
      initialDelayMs: retryOptions.initialDelayMs ?? 1000,
      maxDelayMs: retryOptions.maxDelayMs ?? 30000,
      backoffMultiplier: retryOptions.backoffMultiplier ?? 2,
      jitter: retryOptions.jitter ?? true,
    };
  }

  /**
   * Validate that quorum-native retry mode is properly configured for a specific consumer.
   *
   * Requirements for quorum-native mode:
   * - Consumer queue must be a quorum queue
   * - Consumer queue must have deliveryLimit configured
   * - Consumer queue should have DLX configured (warning if not)
   *
   * @returns TechnicalError if validation fails, null if valid
   */
  private validateQuorumNativeConfigForConsumer(
    consumerName: string,
    consumer: ConsumerDefinition,
  ): TechnicalError | null {
    const queue = consumer.queue;
    const queueType = queue.type ?? "quorum";

    // Check if queue is a quorum queue
    if (queueType !== "quorum") {
      return new TechnicalError(
        `Consumer "${consumerName}" uses queue "${queue.name}" with type "${queueType}". ` +
          `Quorum-native retry mode requires quorum queues.`,
      );
    }

    // Check if deliveryLimit is configured
    if (queue.deliveryLimit === undefined) {
      return new TechnicalError(
        `Consumer "${consumerName}" uses queue "${queue.name}" without deliveryLimit configured. ` +
          `Quorum-native retry mode requires deliveryLimit to be set on the queue definition.`,
      );
    }

    // Check if DLX is configured (warning only)
    if (!queue.deadLetter) {
      this.logger?.warn(
        `Consumer "${consumerName}" uses queue "${queue.name}" without deadLetter configured. ` +
          `Messages exceeding deliveryLimit will be dropped instead of dead-lettered.`,
      );
    }

    return null;
  }

  /**
   * Start consuming messages for all consumers
   */
  private consumeAll(): Future<Result<void, TechnicalError>> {
    if (!this.contract.consumers) {
      return Future.value(Result.Error(new TechnicalError("No consumers defined in contract")));
    }

    // Calculate the maximum prefetch value among all consumers
    // Since prefetch is per-channel in AMQP 0.9.1, we use the maximum value
    const consumerNames = Object.keys(this.contract.consumers) as InferConsumerNames<TContract>[];
    let maxPrefetch = 0;

    for (const consumerName of consumerNames) {
      const options = this.consumerOptions[consumerName];
      if (options?.prefetch !== undefined) {
        if (options.prefetch <= 0 || !Number.isInteger(options.prefetch)) {
          return Future.value(
            Result.Error(
              new TechnicalError(
                `Invalid prefetch value for "${String(consumerName)}": must be a positive integer`,
              ),
            ),
          );
        }
        maxPrefetch = Math.max(maxPrefetch, options.prefetch);
      }
      if (options?.batchSize !== undefined) {
        // Batch consumers need prefetch at least equal to batch size
        const effectivePrefetch = options.prefetch ?? options.batchSize;
        maxPrefetch = Math.max(maxPrefetch, effectivePrefetch);
      }
    }

    // Apply the maximum prefetch if any consumer specified it
    if (maxPrefetch > 0) {
      this.amqpClient.channel.addSetup(async (channel: Channel) => {
        await channel.prefetch(maxPrefetch);
      });
    }

    return Future.all(consumerNames.map((consumerName) => this.consume(consumerName)))
      .map(Result.all)
      .mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.amqpClient.channel.waitForConnect()).mapError(
      (error) => new TechnicalError("Failed to wait for connection ready", error),
    );
  }

  /**
   * Start consuming messages for a specific consumer
   */
  private consume<TName extends InferConsumerNames<TContract>>(
    consumerName: TName,
  ): Future<Result<void, TechnicalError>> {
    const consumers = this.contract.consumers;
    if (!consumers) {
      return Future.value(Result.Error(new TechnicalError("No consumers defined in contract")));
    }

    const consumer = consumers[consumerName as string];
    if (!consumer) {
      const availableConsumers = Object.keys(consumers);
      const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
      return Future.value(
        Result.Error(
          new TechnicalError(
            `Consumer not found: "${String(consumerName)}". Available consumers: ${available}`,
          ),
        ),
      );
    }

    const handler = this.actualHandlers[consumerName];
    if (!handler) {
      return Future.value(
        Result.Error(new TechnicalError(`Handler for "${String(consumerName)}" not provided`)),
      );
    }

    // Get consumer-specific options
    const options = this.consumerOptions[consumerName] ?? {};

    // Validate batch size if specified
    if (options.batchSize !== undefined) {
      if (options.batchSize <= 0 || !Number.isInteger(options.batchSize)) {
        return Future.value(
          Result.Error(
            new TechnicalError(
              `Invalid batchSize for "${String(consumerName)}": must be a positive integer`,
            ),
          ),
        );
      }
    }

    // Validate batch timeout if specified
    if (options.batchTimeout !== undefined) {
      if (
        typeof options.batchTimeout !== "number" ||
        !Number.isFinite(options.batchTimeout) ||
        options.batchTimeout <= 0
      ) {
        return Future.value(
          Result.Error(
            new TechnicalError(
              `Invalid batchTimeout for "${String(consumerName)}": must be a positive number`,
            ),
          ),
        );
      }
    }

    // Check if this is a batch consumer
    const isBatchConsumer = options.batchSize !== undefined && options.batchSize > 0;

    if (isBatchConsumer) {
      return this.consumeBatch(
        consumerName,
        consumer,
        options,
        // All handlers are now safe handlers (Future<Result>)
        handler as (
          messages: Array<WorkerInferConsumedMessage<TContract, TName>>,
          rawMessages: ConsumeMessage[],
        ) => Future<Result<void, HandlerError>>,
      );
    } else {
      return this.consumeSingle(
        consumerName,
        consumer,
        // All handlers are now safe handlers (Future<Result>)
        handler as (
          message: WorkerInferConsumedMessage<TContract, TName>,
          rawMessage: ConsumeMessage,
        ) => Future<Result<void, HandlerError>>,
      );
    }
  }

  /**
   * Parse and validate a message from AMQP
   * @returns `Future<Result<consumed message, void>>` - Ok with validated consumed message (payload + headers), or Error (already handled with nack)
   */
  private parseAndValidateMessage<TName extends InferConsumerNames<TContract>>(
    msg: Message,
    consumer: ConsumerDefinition,
    consumerName: TName,
  ): Future<Result<WorkerInferConsumedMessage<TContract, TName>, void>> {
    // Decompress message if needed
    const decompressMessage = Future.fromPromise(
      decompressBuffer(msg.content, msg.properties.contentEncoding),
    ).tapError((error) => {
      this.logger?.error("Error decompressing message", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        contentEncoding: msg.properties.contentEncoding,
        error,
      });

      // Reject message with no requeue (decompression failed)
      this.amqpClient.channel.nack(msg, false, false);
    });

    // Parse message
    const parseMessage = (buffer: Buffer) => {
      const parseResult = Result.fromExecution(() => JSON.parse(buffer.toString()));
      if (parseResult.isError()) {
        this.logger?.error("Error parsing message", {
          consumerName: String(consumerName),
          queueName: consumer.queue.name,
          error: parseResult.error,
        });

        // Reject message with no requeue (malformed JSON)
        this.amqpClient.channel.nack(msg, false, false);
        return Future.value(Result.Error(undefined));
      }
      return Future.value(Result.Ok(parseResult.value));
    };

    // Validate payload
    const validatePayload = (parsedMessage: unknown) => {
      const rawValidation = consumer.message.payload["~standard"].validate(parsedMessage);
      return Future.fromPromise(
        rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation),
      ).mapOkToResult((validationResult) => {
        if (validationResult.issues) {
          const error = new MessageValidationError(String(consumerName), validationResult.issues);
          this.logger?.error("Message payload validation failed", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            error,
          });

          // Reject message with no requeue (validation failed)
          this.amqpClient.channel.nack(msg, false, false);
          return Result.Error(undefined);
        }

        return Result.Ok(validationResult.value);
      });
    };

    // Validate headers (if schema is defined)
    const validateHeaders = (): Future<Result<unknown, void>> => {
      const headersSchema = consumer.message.headers;
      if (!headersSchema) {
        // No headers schema defined - return undefined for headers
        return Future.value(Result.Ok(undefined));
      }

      const rawHeaders = msg.properties.headers ?? {};
      // Type assertion needed because headers is typed as THeaders | undefined
      // but we've already checked it's defined above
      const schema = headersSchema as { "~standard": { validate: (data: unknown) => unknown } };
      const rawValidation = schema["~standard"].validate(rawHeaders);
      return Future.fromPromise(
        rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation),
      ).mapOkToResult(
        (validationResult: { issues?: unknown; value?: unknown } | { value: unknown }) => {
          if ("issues" in validationResult && validationResult.issues) {
            const error = new MessageValidationError(
              String(consumerName),
              `Headers validation failed: ${JSON.stringify(validationResult.issues)}`,
            );
            this.logger?.error("Message headers validation failed", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
              error,
            });

            // Reject message with no requeue (validation failed)
            this.amqpClient.channel.nack(msg, false, false);
            return Result.Error<unknown, void>(undefined);
          }

          return Result.Ok<unknown, void>(validationResult.value);
        },
      );
    };

    // Build the consumed message
    const buildConsumedMessage = (
      validatedPayload: unknown,
    ): Future<Result<WorkerInferConsumedMessage<TContract, TName>, void>> => {
      return validateHeaders().mapOk((validatedHeaders) => {
        if (validatedHeaders === undefined) {
          // No headers schema - return payload only
          return { payload: validatedPayload } as WorkerInferConsumedMessage<TContract, TName>;
        }
        // Headers schema defined - return both payload and headers
        return {
          payload: validatedPayload,
          headers: validatedHeaders,
        } as WorkerInferConsumedMessage<TContract, TName>;
      });
    };

    return decompressMessage
      .flatMapOk(parseMessage)
      .flatMapOk(validatePayload)
      .flatMapOk(buildConsumedMessage);
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
    return Future.fromPromise(
      this.amqpClient.channel.consume(queueName, async (msg) => {
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
                this.amqpClient.channel.ack(msg);

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
      }),
    )
      .tapOk((reply) => {
        // Store consumer tag for later cancellation
        this.consumerTags.add(reply.consumerTag);
      })
      .mapError(
        (error) =>
          new TechnicalError(`Failed to start consuming for "${String(consumerName)}"`, error),
      )
      .mapOk(() => undefined);
  }

  /**
   * Handle batch processing error by applying error handling to all messages.
   */
  private handleBatchError(
    error: HandlerError,
    currentBatch: Array<{ amqpMessage: ConsumeMessage }>,
    consumerName: string,
    consumer: ConsumerDefinition,
  ): Future<Result<void, TechnicalError>> {
    return Future.all(
      currentBatch.map((item) => this.handleError(error, item.amqpMessage, consumerName, consumer)),
    )
      .map(Result.all)
      .mapOk(() => undefined);
  }

  /**
   * Consume messages in batches
   */
  private consumeBatch<TName extends InferConsumerNames<TContract>>(
    consumerName: TName,
    consumer: ConsumerDefinition,
    options: ConsumerOptions,
    handler: (
      messages: Array<WorkerInferConsumedMessage<TContract, TName>>,
      rawMessages: ConsumeMessage[],
    ) => Future<Result<void, HandlerError>>,
  ): Future<Result<void, TechnicalError>> {
    const batchSize = options.batchSize!;
    const batchTimeout = options.batchTimeout ?? 1000;
    const timerKey = String(consumerName);
    const queueName = consumer.queue.name;

    // Note: Prefetch is handled globally in consumeAll()
    // Batch accumulation state
    type BatchItem = {
      message: WorkerInferConsumedMessage<TContract, TName>;
      amqpMessage: ConsumeMessage;
    };
    let batch: BatchItem[] = [];
    // Track if batch processing is currently in progress to avoid race conditions
    let isProcessing = false;

    const processBatch = (): Future<Result<void, TechnicalError>> => {
      // Prevent concurrent batch processing
      if (isProcessing || batch.length === 0) {
        return Future.value(Result.Ok(undefined));
      }

      isProcessing = true;

      const currentBatch = batch;
      batch = [];

      // Clear timer from tracking
      const timer = this.batchTimers.get(timerKey);
      if (timer) {
        clearTimeout(timer);
        this.batchTimers.delete(timerKey);
      }

      const messages = currentBatch.map((item) => item.message);
      const rawMessages = currentBatch.map((item) => item.amqpMessage);
      const batchCount = currentBatch.length;

      // Start telemetry span for batch processing
      const startTime = Date.now();
      const span = startConsumeSpan(this.telemetry, queueName, String(consumerName), {
        "amqp.batch.size": batchCount,
      });

      this.logger?.info("Processing batch", {
        consumerName: String(consumerName),
        queueName,
        batchSize: batchCount,
      });

      return handler(messages, rawMessages)
        .flatMapOk(() => {
          // Acknowledge all messages in the batch on success
          for (const item of currentBatch) {
            this.amqpClient.channel.ack(item.amqpMessage);
          }

          this.logger?.info("Batch processed successfully", {
            consumerName: String(consumerName),
            queueName,
            batchSize: batchCount,
          });

          // Record telemetry success
          const durationMs = Date.now() - startTime;
          endSpanSuccess(span);
          recordConsumeMetric(this.telemetry, queueName, String(consumerName), true, durationMs);

          return Future.value(Result.Ok<void, TechnicalError>(undefined));
        })
        .flatMapError((handlerError: HandlerError) => {
          // Handler returned an error - log it
          this.logger?.error("Error processing batch", {
            consumerName: String(consumerName),
            queueName,
            batchSize: batchCount,
            errorType: handlerError.name,
            error: handlerError.message,
          });

          // Record telemetry failure
          const durationMs = Date.now() - startTime;
          endSpanError(span, handlerError);
          recordConsumeMetric(this.telemetry, queueName, String(consumerName), false, durationMs);

          // Handle error for each message in the batch
          return this.handleBatchError(handlerError, currentBatch, String(consumerName), consumer);
        })
        .tap(() => {
          isProcessing = false;
        });
    };

    const scheduleBatchProcessing = () => {
      // Don't schedule if batch is currently being processed
      if (isProcessing) {
        return;
      }

      // Clear existing timer
      const existingTimer = this.batchTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule new timer and track it
      const timer = setTimeout(() => {
        processBatch().toPromise();
      }, batchTimeout);

      this.batchTimers.set(timerKey, timer);
    };

    // Start consuming
    return Future.fromPromise(
      this.amqpClient.channel.consume(queueName, async (msg) => {
        // Handle null messages (consumer cancellation)
        if (msg === null) {
          this.logger?.warn("Consumer cancelled by server", {
            consumerName: String(consumerName),
            queueName,
          });
          // Process any remaining messages in the batch
          await processBatch().toPromise();
          return;
        }

        // Parse and validate message
        const validationResult = await this.parseAndValidateMessage(
          msg,
          consumer,
          consumerName,
        ).toPromise();

        if (validationResult.isError()) {
          // Error already handled in parseAndValidateMessage (nacked)
          return;
        }

        // Add to batch
        batch.push({
          message: validationResult.value,
          amqpMessage: msg,
        });

        // Process batch if full
        if (batch.length >= batchSize) {
          await processBatch().toPromise();
          // After processing a full batch, schedule timer for any subsequent messages
          // This ensures that if more messages arrive at a slow rate, they won't be held indefinitely
          if (batch.length > 0 && !this.batchTimers.has(timerKey)) {
            scheduleBatchProcessing();
          }
        } else {
          // Schedule batch processing if not already scheduled
          if (!this.batchTimers.has(timerKey)) {
            scheduleBatchProcessing();
          }
        }
      }),
    )
      .tapOk((reply) => {
        // Store consumer tag for later cancellation
        this.consumerTags.add(reply.consumerTag);
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
    msg: Message,
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

    // Get consumer-specific retry config
    const typedConsumerName = consumerName as InferConsumerNames<TContract>;
    const options = this.consumerOptions[typedConsumerName] ?? {};
    const retryOptions = options.retry ?? {};

    // Resolve retry config with defaults (retry is always enabled)
    const config = this.resolveRetryConfig(retryOptions);

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
    msg: Message,
    consumerName: string,
    consumer: ConsumerDefinition,
  ): Future<Result<void, TechnicalError>> {
    const queueName = consumer.queue.name;
    // x-delivery-count is incremented on each delivery attempt
    // When x-delivery-count equals x-delivery-limit, message is dead-lettered on next attempt
    const deliveryCount = (msg.properties.headers?.["x-delivery-count"] as number) ?? 0;
    const deliveryLimit = consumer.queue.deliveryLimit;

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
    this.amqpClient.channel.nack(msg, false, true);
    return Future.value(Result.Ok(undefined));
  }

  /**
   * Handle error using TTL + wait queue pattern for exponential backoff.
   */
  private handleErrorTtlBackoff(
    error: Error,
    msg: Message,
    consumerName: string,
    consumer: ConsumerDefinition,
    config: ResolvedRetryConfig,
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
  private calculateRetryDelay(retryCount: number, config: ResolvedRetryConfig): number {
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
  private parseMessageContentForRetry(msg: Message, queueName: string): Buffer | unknown {
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
    msg: Message,
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
      this.amqpClient.channel.nack(msg, false, true);
      return Future.value(Result.Ok(undefined));
    }

    const dlxName = deadLetter.exchange.name;
    const waitRoutingKey = `${queueName}-wait`;

    // Acknowledge original message
    this.amqpClient.channel.ack(msg);

    const content = this.parseMessageContentForRetry(msg, queueName);

    // Publish to DLX with wait routing key
    return Future.fromPromise(
      this.amqpClient.channel.publish(dlxName, waitRoutingKey, content, {
        ...msg.properties,
        expiration: delayMs.toString(), // Per-message TTL
        headers: {
          ...msg.properties.headers,
          "x-retry-count": newRetryCount,
          "x-last-error": error.message,
          "x-first-failure-timestamp":
            msg.properties.headers?.["x-first-failure-timestamp"] ?? Date.now(),
        },
      }),
    )
      .mapError((error) => new TechnicalError("Failed to publish message for retry", error))
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
  private sendToDLQ(msg: Message, consumer: ConsumerDefinition): void {
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
    this.amqpClient.channel.nack(msg, false, false);
  }
}
