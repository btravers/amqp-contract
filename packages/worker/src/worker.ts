import { AmqpClient, type Logger } from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { Channel, Message } from "amqplib";
import type {
  ConsumerDefinition,
  ContractDefinition,
  InferConsumerNames,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import {
  MessageValidationError,
  NonRetryableError,
  RetryableError,
  TechnicalError,
} from "./errors.js";
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
 * Retry configuration options for handling transient failures.
 * When enabled, the worker will automatically retry failed messages with exponential backoff
 * and route them to a Dead Letter Queue (DLQ) after exhausting all retries.
 */
export type RetryOptions = {
  /** Maximum number of retry attempts before sending to DLQ (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds between retries (default: 30000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
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
 *   logger: myLogger
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
  /** Retry configuration for handling transient failures */
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
  private readonly retryConfig: Required<RetryOptions>;

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly logger?: Logger,
    retryOptions?: RetryOptions,
  ) {
    // Set default retry configuration
    this.retryConfig = {
      maxRetries: retryOptions?.maxRetries ?? 3,
      initialDelayMs: retryOptions?.initialDelayMs ?? 1000,
      maxDelayMs: retryOptions?.maxDelayMs ?? 30000,
      backoffMultiplier: retryOptions?.backoffMultiplier ?? 2,
      jitter: retryOptions?.jitter ?? true,
    };

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
   * Calculate exponential backoff delay with optional jitter
   */
  private calculateBackoffDelay(retryCount: number): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier, jitter } = this.retryConfig;

    // Safeguard against extremely large retry counts that could cause overflow
    const safeRetryCount = Math.min(retryCount, 20); // Cap at 20 to prevent overflow

    // Calculate exponential backoff: initialDelay * (multiplier ^ retryCount)
    let delay = initialDelayMs * backoffMultiplier ** safeRetryCount;

    // Cap at max delay
    delay = Math.min(delay, maxDelayMs);

    // Apply jitter if enabled: multiply by random value between 0.5 and 1.0
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Get retry count from message headers
   */
  private getRetryCount(msg: Message): number {
    const retryCount = msg.properties.headers?.["x-retry-count"];
    return typeof retryCount === "number" ? retryCount : 0;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    // NonRetryableError always means don't retry
    if (error instanceof NonRetryableError) {
      return false;
    }

    // RetryableError means retry
    if (error instanceof RetryableError) {
      return true;
    }

    // Unknown errors are treated as retryable by default (backward compatible)
    return true;
  }

  /**
   * Republish message for retry with updated headers
   *
   * Note: This implementation uses setTimeout for simplicity and reliability.
   * While this blocks the event loop during the delay, it ensures:
   * - Message order is preserved
   * - No additional infrastructure (delay queues) required
   * - Predictable retry timing
   * For high-throughput scenarios, consider using RabbitMQ delayed message plugin.
   */
  private async republishForRetry(
    msg: Message,
    consumer: ConsumerDefinition,
    retryCount: number,
    delayMs: number,
    error: unknown,
  ): Promise<void> {
    // Wait for the calculated delay before republishing
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Prepare headers with retry information
    const headers = {
      ...msg.properties.headers,
      "x-retry-count": retryCount + 1,
      "x-last-error": error instanceof Error ? error.message : String(error),
      "x-first-failure-timestamp":
        msg.properties.headers?.["x-first-failure-timestamp"] ?? Date.now(),
    };

    // Republish to the same queue
    await this.amqpClient.channel.sendToQueue(consumer.queue.name, msg.content, {
      ...msg.properties,
      headers,
    });

    // Acknowledge the original message
    this.amqpClient.channel.ack(msg);
  }

  /**
   * Send message to Dead Letter Queue by nacking without requeue
   */
  private sendToDLQ(msg: Message): void {
    // Nack without requeue - RabbitMQ will route to DLX if configured
    this.amqpClient.channel.nack(msg, false, false);
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
    ).mapError((error) => {
      this.logger?.error("Error decompressing message", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        contentEncoding: msg.properties.contentEncoding,
        error,
      });

      // Reject message with no requeue (decompression failed)
      this.amqpClient.channel.nack(msg, false, false);
      return undefined;
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
        const validationResult = await this.parseAndValidateMessage(
          msg,
          consumer,
          consumerName,
        ).toPromise();

        if (validationResult.isError()) {
          // Validation/parsing errors are already handled (nacked) in parseAndValidateMessage
          return;
        }

        // Process message with handler
        try {
          await handler(validationResult.value);

          // Success - acknowledge message
          this.logger?.info("Message consumed successfully", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
          });
          this.amqpClient.channel.ack(msg);
        } catch (error) {
          // Handler error - apply retry logic
          const retryCount = this.getRetryCount(msg);
          const isRetryable = this.isRetryableError(error);

          this.logger?.error("Error processing message", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            retryCount,
            isRetryable,
            error,
          });

          // Handle non-retryable errors immediately
          if (!isRetryable) {
            this.logger?.warn("Non-retryable error, sending to DLQ", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
              error: error instanceof Error ? error.message : String(error),
            });
            this.sendToDLQ(msg);
            return;
          }

          // Check if we've exceeded max retries
          if (retryCount >= this.retryConfig.maxRetries) {
            this.logger?.error("Max retries exceeded, sending to DLQ", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
              totalRetries: this.retryConfig.maxRetries,
              error: error instanceof Error ? error.message : String(error),
            });
            this.sendToDLQ(msg);
            return;
          }

          // Calculate backoff delay and retry
          const nextRetryDelayMs = this.calculateBackoffDelay(retryCount);
          this.logger?.warn("Retrying message", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            retryCount,
            nextRetryDelayMs,
            error: error instanceof Error ? error.message : String(error),
          });

          try {
            await this.republishForRetry(msg, consumer, retryCount, nextRetryDelayMs, error);
          } catch (republishError) {
            this.logger?.error("Failed to republish message for retry, falling back to requeue", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
              originalError: error instanceof Error ? error.message : String(error),
              republishError:
                republishError instanceof Error ? republishError.message : String(republishError),
              retryCount,
            });
            // If republish fails, nack with requeue as fallback
            // This ensures the message is not lost but may bypass retry delays
            this.amqpClient.channel.nack(msg, false, true);
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

    const processBatch = async () => {
      // Prevent concurrent batch processing
      if (isProcessing || batch.length === 0) {
        return;
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

      try {
        await handler(messages);

        // Acknowledge all messages in the batch
        for (const item of currentBatch) {
          this.amqpClient.channel.ack(item.amqpMessage);
        }

        this.logger?.info("Batch processed successfully", {
          consumerName: String(consumerName),
          queueName: consumer.queue.name,
          batchSize: currentBatch.length,
        });
      } catch (error) {
        const isRetryable = this.isRetryableError(error);

        this.logger?.error("Error processing batch", {
          consumerName: String(consumerName),
          queueName: consumer.queue.name,
          batchSize: currentBatch.length,
          isRetryable,
          error,
        });

        // Handle non-retryable errors - send all messages to DLQ
        if (!isRetryable) {
          this.logger?.warn("Non-retryable error in batch, sending all messages to DLQ", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            batchSize: currentBatch.length,
            error: error instanceof Error ? error.message : String(error),
          });
          for (const item of currentBatch) {
            this.sendToDLQ(item.amqpMessage);
          }
          return;
        }

        // For retryable errors, handle each message individually
        for (const item of currentBatch) {
          const retryCount = this.getRetryCount(item.amqpMessage);

          // Check if we've exceeded max retries
          if (retryCount >= this.retryConfig.maxRetries) {
            this.logger?.error("Max retries exceeded for message in batch, sending to DLQ", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
              totalRetries: this.retryConfig.maxRetries,
              error: error instanceof Error ? error.message : String(error),
            });
            this.sendToDLQ(item.amqpMessage);
            continue;
          }

          // Calculate backoff delay and retry
          const nextRetryDelayMs = this.calculateBackoffDelay(retryCount);
          this.logger?.warn("Retrying message from batch", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            retryCount,
            nextRetryDelayMs,
            error: error instanceof Error ? error.message : String(error),
          });

          try {
            await this.republishForRetry(
              item.amqpMessage,
              consumer,
              retryCount,
              nextRetryDelayMs,
              error,
            );
          } catch (republishError) {
            this.logger?.error(
              "Failed to republish batch message for retry, falling back to requeue",
              {
                consumerName: String(consumerName),
                queueName: consumer.queue.name,
                originalError: error instanceof Error ? error.message : String(error),
                republishError:
                  republishError instanceof Error ? republishError.message : String(republishError),
                retryCount,
              },
            );
            // If republish fails, nack with requeue as fallback
            this.amqpClient.channel.nack(item.amqpMessage, false, true);
          }
        }
      } finally {
        isProcessing = false;
      }
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
        processBatch().catch((error) => {
          this.logger?.error("Unexpected error in batch processing", {
            consumerName: String(consumerName),
            error,
          });
        });
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
          await processBatch();
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
          await processBatch();
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
}
