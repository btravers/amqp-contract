import { AmqpClient, type Logger } from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { Channel, Message } from "amqplib";
import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type {
  WorkerInferConsumerBatchHandler,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlers,
  WorkerInferConsumerInput,
} from "./types.js";
import { decompressBuffer } from "./decompression.js";

/**
 * Internal type for consumer options extracted from handler tuples.
 * Not exported - options are specified inline in the handler tuple types.
 * Uses discriminated union to enforce mutual exclusivity:
 * - Prefetch-only mode: Cannot have batchSize or batchTimeout
 * - Batch mode: Requires batchSize, allows batchTimeout and prefetch
 */
type ConsumerOptions =
  | {
      /** Prefetch-based processing (no batching) */
      prefetch?: number;
      batchSize?: never;
      batchTimeout?: never;
    }
  | {
      /** Batch-based processing */
      prefetch?: number;
      batchSize: number;
      batchTimeout?: number;
    };

/**
 * Retry configuration options for handling failed message processing.
 *
 * When enabled, the worker will automatically retry failed messages using
 * RabbitMQ's native TTL + Dead Letter Exchange (DLX) pattern.
 */
export type RetryOptions = {
  /** Maximum retry attempts before sending to DLQ (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
};

/**
 * Internal retry configuration with all values resolved.
 */
type ResolvedRetryConfig = {
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
 *     // Simple handler
 *     processOrder: async (message) => {
 *       console.log('Processing order:', message.orderId);
 *     },
 *     // Handler with options (prefetch)
 *     processPayment: [
 *       async (message) => {
 *         console.log('Processing payment:', message.paymentId);
 *       },
 *       { prefetch: 10 }
 *     ],
 *     // Handler with batch processing
 *     processNotifications: [
 *       async (messages) => {
 *         console.log('Processing batch:', messages.length);
 *       },
 *       { batchSize: 5, batchTimeout: 1000 }
 *     ]
 *   },
 *   urls: ['amqp://localhost'],
 *   connectionOptions: {
 *     heartbeatIntervalInSeconds: 30
 *   },
 *   logger: myLogger,
 *   retry: {
 *     maxRetries: 3,
 *     initialDelayMs: 1000,
 *     maxDelayMs: 30000,
 *     backoffMultiplier: 2,
 *     jitter: true
 *   }
 * };
 * ```
 */
export type CreateWorkerOptions<TContract extends ContractDefinition> = {
  /** The AMQP contract definition specifying consumers and their message schemas */
  contract: TContract;
  /** Handlers for each consumer defined in the contract. Can be a function or a tuple of [handler, options] */
  handlers: WorkerInferConsumerHandlers<TContract>;
  /** AMQP broker URL(s). Multiple URLs provide failover support */
  urls: ConnectionUrl[];
  /** Optional connection configuration (heartbeat, reconnect settings, etc.) */
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  /** Optional logger for logging message consumption and errors */
  logger?: Logger | undefined;
  /** Retry configuration - when undefined, uses legacy behavior (immediate requeue) */
  retry?: RetryOptions | undefined;
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
  private readonly actualHandlers: Partial<
    Record<
      InferConsumerNames<TContract>,
      | WorkerInferConsumerHandler<TContract, InferConsumerNames<TContract>>
      | WorkerInferConsumerBatchHandler<TContract, InferConsumerNames<TContract>>
    >
  >;
  private readonly consumerOptions: Partial<Record<InferConsumerNames<TContract>, ConsumerOptions>>;
  private readonly batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly consumerTags: Set<string> = new Set();
  private readonly retryConfig: ResolvedRetryConfig | null;

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly logger?: Logger,
    retryOptions?: RetryOptions,
  ) {
    // Extract handlers and options from the handlers object
    this.actualHandlers = {};
    this.consumerOptions = {};

    for (const consumerName of Object.keys(handlers) as InferConsumerNames<TContract>[]) {
      const handlerEntry = handlers[consumerName];

      if (Array.isArray(handlerEntry)) {
        // Tuple format: [handler, options]
        // Type assertion is safe: The discriminated union in WorkerInferConsumerHandlerEntry
        // ensures the handler matches the options (single-message or batch handler).
        // TypeScript loses this type relationship during runtime extraction, but it's
        // guaranteed by the type system at compile time.
        this.actualHandlers[consumerName] = handlerEntry[0] as unknown as
          | WorkerInferConsumerHandler<TContract, InferConsumerNames<TContract>>
          | WorkerInferConsumerBatchHandler<TContract, InferConsumerNames<TContract>>;
        this.consumerOptions[consumerName] = handlerEntry[1];
      } else {
        // Direct function format
        // Type assertion is safe: handlerEntry is guaranteed to be a function type
        // by the discriminated union, but TypeScript needs help with the union narrowing.
        this.actualHandlers[consumerName] = handlerEntry as unknown as
          | WorkerInferConsumerHandler<TContract, InferConsumerNames<TContract>>
          | WorkerInferConsumerBatchHandler<TContract, InferConsumerNames<TContract>>;
      }
    }

    // Initialize retry configuration
    if (retryOptions === undefined) {
      this.retryConfig = null; // Legacy behavior
    } else {
      // Set defaults for retry options
      this.retryConfig = {
        maxRetries: retryOptions.maxRetries ?? 3,
        initialDelayMs: retryOptions.initialDelayMs ?? 1000,
        maxDelayMs: retryOptions.maxDelayMs ?? 30000,
        backoffMultiplier: retryOptions.backoffMultiplier ?? 2,
        jitter: retryOptions.jitter ?? true,
      };
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
    retry,
  }: CreateWorkerOptions<TContract>): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>> {
    const worker = new TypedAmqpWorker(
      contract,
      new AmqpClient(contract, {
        urls,
        connectionOptions,
      }),
      handlers,
      logger,
      retry,
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
   * Creates and binds wait queues for each consumer queue that has DLX configuration.
   */
  private setupWaitQueues(): Future<Result<void, TechnicalError>> {
    // Skip if retry is not configured
    if (this.retryConfig === null) {
      return Future.value(Result.Ok(undefined));
    }

    if (!this.contract.consumers || !this.contract.queues) {
      return Future.value(Result.Ok(undefined));
    }

    const setupTasks: Array<Future<Result<void, TechnicalError>>> = [];

    for (const consumerName of Object.keys(
      this.contract.consumers,
    ) as InferConsumerNames<TContract>[]) {
      const consumer = this.contract.consumers[consumerName as string];
      if (!consumer) continue;

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
        handler as unknown as (
          messages: Array<WorkerInferConsumerInput<TContract, TName>>,
        ) => Promise<void>,
      );
    } else {
      return this.consumeSingle(
        consumerName,
        consumer,
        handler as unknown as (
          message: WorkerInferConsumerInput<TContract, TName>,
        ) => Promise<void>,
      );
    }
  }

  /**
   * Parse and validate a message from AMQP
   * @returns Future<Result<validated message, void>> - Ok with validated message, or Error (already handled with nack)
   */
  private parseAndValidateMessage<TName extends InferConsumerNames<TContract>>(
    msg: Message,
    consumer: ConsumerDefinition,
    consumerName: TName,
  ): Future<Result<WorkerInferConsumerInput<TContract, TName>, void>> {
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

    // Validate message
    const validateMessage = (parsedMessage: unknown) => {
      const rawValidation = consumer.message.payload["~standard"].validate(parsedMessage);
      return Future.fromPromise(
        rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation),
      ).mapOkToResult((validationResult) => {
        if (validationResult.issues) {
          const error = new MessageValidationError(String(consumerName), validationResult.issues);
          this.logger?.error("Message validation failed", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            error,
          });

          // Reject message with no requeue (validation failed)
          this.amqpClient.channel.nack(msg, false, false);
          return Result.Error(undefined) as Result<
            WorkerInferConsumerInput<TContract, TName>,
            void
          >;
        }

        return Result.Ok(validationResult.value as WorkerInferConsumerInput<TContract, TName>);
      }) as Future<Result<WorkerInferConsumerInput<TContract, TName>, void>>;
    };

    return decompressMessage.flatMapOk(parseMessage).flatMapOk(validateMessage) as Future<
      Result<WorkerInferConsumerInput<TContract, TName>, void>
    >;
  }

  /**
   * Consume messages one at a time
   */
  private consumeSingle<TName extends InferConsumerNames<TContract>>(
    consumerName: TName,
    consumer: ConsumerDefinition,
    handler: (message: WorkerInferConsumerInput<TContract, TName>) => Promise<void>,
  ): Future<Result<void, TechnicalError>> {
    // Start consuming
    return Future.fromPromise(
      this.amqpClient.channel.consume(consumer.queue.name, async (msg) => {
        // Handle null messages (consumer cancellation)
        if (msg === null) {
          this.logger?.warn("Consumer cancelled by server", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
          });
          return;
        }

        // Parse and validate message
        await this.parseAndValidateMessage(msg, consumer, consumerName)
          .flatMapOk((validatedMessage) =>
            Future.fromPromise(handler(validatedMessage))
              .mapOk(() => {
                this.logger?.info("Message consumed successfully", {
                  consumerName: String(consumerName),
                  queueName: consumer.queue.name,
                });

                // Acknowledge message on success
                this.amqpClient.channel.ack(msg);
                return undefined;
              })
              .tapError((error) => {
                this.logger?.error("Error processing message", {
                  consumerName: String(consumerName),
                  queueName: consumer.queue.name,
                  error,
                });
              })
              .flatMapError((error) => {
                // Use retry mechanism - handleError will manage ack/nack
                const errorObj = error instanceof Error ? error : new Error(String(error));
                return this.handleError(errorObj, msg, String(consumerName), consumer);
              }),
          )
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
    error: unknown,
    currentBatch: Array<{ amqpMessage: Message }>,
    consumerName: string,
    consumer: ConsumerDefinition,
  ): Future<Result<void, TechnicalError>> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    return Future.all(
      currentBatch.map((item) =>
        this.handleError(errorObj, item.amqpMessage, consumerName, consumer),
      ),
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
    handler: (messages: Array<WorkerInferConsumerInput<TContract, TName>>) => Promise<void>,
  ): Future<Result<void, TechnicalError>> {
    const batchSize = options.batchSize!;
    const batchTimeout = options.batchTimeout ?? 1000;
    const timerKey = String(consumerName);

    // Note: Prefetch is handled globally in consumeAll()
    // Batch accumulation state
    type BatchItem = {
      message: WorkerInferConsumerInput<TContract, TName>;
      amqpMessage: Message;
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

      this.logger?.info("Processing batch", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        batchSize: currentBatch.length,
      });

      return Future.fromPromise(handler(messages))
        .mapOk(() => {
          // Acknowledge all messages in the batch on success
          for (const item of currentBatch) {
            this.amqpClient.channel.ack(item.amqpMessage);
          }

          this.logger?.info("Batch processed successfully", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            batchSize: currentBatch.length,
          });
          return undefined;
        })
        .tapError((error) => {
          this.logger?.error("Error processing batch", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            batchSize: currentBatch.length,
            error,
          });
        })
        .flatMapError((error) => {
          // Handle error for each message in the batch - handleBatchError will manage ack/nack
          // NOTE: All messages in the batch are treated the same way.
          // For partial batch success handling, consider implementing message-level error tracking.
          return this.handleBatchError(error, currentBatch, String(consumerName), consumer);
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
      this.amqpClient.channel.consume(consumer.queue.name, async (msg) => {
        // Handle null messages (consumer cancellation)
        if (msg === null) {
          this.logger?.warn("Consumer cancelled by server", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
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
   * Flow:
   * 1. If no retry config -> legacy behavior (immediate requeue)
   * 2. If max retries exceeded -> send to DLQ
   * 3. Otherwise -> publish to wait queue with TTL for retry
   */
  private handleError(
    error: Error,
    msg: Message,
    consumerName: string,
    consumer: ConsumerDefinition,
  ): Future<Result<void, TechnicalError>> {
    // If no retry config, use legacy behavior
    if (this.retryConfig === null) {
      this.logger?.warn("Error in handler (legacy mode: immediate requeue)", {
        consumerName,
        error: error.message,
      });
      this.amqpClient.channel.nack(msg, false, true); // Requeue immediately
      return Future.value(Result.Ok(undefined));
    }

    // Get retry count from headers
    const retryCount = (msg.properties.headers?.["x-retry-count"] as number) ?? 0;

    // Max retries exceeded -> DLQ
    // retryConfig is guaranteed to be non-null at this point
    const config = this.retryConfig as ResolvedRetryConfig;
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
    const delayMs = this.calculateRetryDelay(retryCount);
    this.logger?.warn("Retrying message", {
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
  private calculateRetryDelay(retryCount: number): number {
    // retryConfig is guaranteed to be non-null when this method is called
    const config = this.retryConfig as ResolvedRetryConfig;
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
