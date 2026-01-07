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
import { RETRY_COUNT_HEADER, shouldRetry } from "./retry.js";
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

  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly logger?: Logger,
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
  }: CreateWorkerOptions<TContract>): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>> {
    const worker = new TypedAmqpWorker(
      contract,
      new AmqpClient(contract, {
        urls,
        connectionOptions,
      }),
      handlers,
      logger,
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
   * Handle message retry logic based on consumer retry policy.
   * This method decides whether to retry, send to DLX, or reject the message.
   *
   * @param msg - The AMQP message
   * @param consumer - The consumer definition
   * @param consumerName - The consumer name for logging
   * @returns Promise that resolves when retry handling is complete
   */
  private async handleMessageRetry<TName extends InferConsumerNames<TContract>>(
    msg: Message,
    consumer: ConsumerDefinition,
    consumerName: TName,
  ): Promise<void> {
    const retryPolicy = consumer.retryPolicy;

    // Legacy behavior: no retry policy configured - use simple requeue
    if (!retryPolicy) {
      this.logger?.info("Requeuing message (legacy behavior - no retry policy)", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
      });
      this.amqpClient.channel.nack(msg, false, true);
      return;
    }

    const {
      shouldRetry: shouldRetryMessage,
      delay,
      currentRetryCount,
    } = shouldRetry(msg, retryPolicy);

    if (!shouldRetryMessage) {
      // Max retries exceeded - reject without requeue
      // The message will go to DLX if configured on the queue, otherwise discarded
      this.logger?.warn("Message retry limit exceeded, rejecting", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        retryCount: currentRetryCount,
        maxRetries: retryPolicy.maxRetries,
      });
      this.amqpClient.channel.nack(msg, false, false);
      return;
    }

    // Increment retry count and schedule retry
    const newRetryCount = currentRetryCount + 1;

    // Update retry count in headers for next attempt
    const headers = {
      ...msg.properties.headers,
      [RETRY_COUNT_HEADER]: newRetryCount,
    };

    if (delay > 0) {
      // Apply backoff delay before requeuing
      this.logger?.info("Scheduling message retry with backoff", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        retryCount: newRetryCount,
        delayMs: delay,
      });

      // Wait for backoff delay, then republish with updated retry count
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      this.logger?.info("Requeuing message for immediate retry", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        retryCount: newRetryCount,
      });
    }

    // Republish the message with incremented retry count
    try {
      // Publish to the default exchange with the queue name as the routing key
      // This is the standard way to send messages directly to a queue in AMQP
      const published = await this.amqpClient.channel.publish(
        "", // default exchange
        consumer.queue.name, // routing key = queue name
        msg.content,
        {
          contentType: msg.properties.contentType,
          contentEncoding: msg.properties.contentEncoding,
          headers,
          deliveryMode: msg.properties.deliveryMode,
          priority: msg.properties.priority,
          correlationId: msg.properties.correlationId,
          replyTo: msg.properties.replyTo,
          expiration: msg.properties.expiration,
          messageId: msg.properties.messageId,
          timestamp: msg.properties.timestamp,
          type: msg.properties.type,
          userId: msg.properties.userId,
          appId: msg.properties.appId,
        },
      );

      this.logger?.info("Message republished for retry", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        retryCount: newRetryCount,
        published,
      });

      // Acknowledge the original message after successful republish
      this.amqpClient.channel.ack(msg);
    } catch (error) {
      this.logger?.error("Failed to republish message for retry", {
        consumerName: String(consumerName),
        queueName: consumer.queue.name,
        retryCount: newRetryCount,
        error,
      });
      // If republish fails, nack with requeue to avoid message loss
      this.amqpClient.channel.nack(msg, false, true);
    }
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
            Future.fromPromise(handler(validatedMessage)).tapError(async (error) => {
              this.logger?.error("Error processing message", {
                consumerName: String(consumerName),
                queueName: consumer.queue.name,
                error,
              });

              // Handle retry logic based on retry policy
              await this.handleMessageRetry(msg, consumer, consumerName);
            }),
          )
          .tapOk(() => {
            this.logger?.info("Message consumed successfully", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
            });

            // Acknowledge message
            this.amqpClient.channel.ack(msg);
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
        this.logger?.error("Error processing batch", {
          consumerName: String(consumerName),
          queueName: consumer.queue.name,
          batchSize: currentBatch.length,
          error,
        });

        // Handle retry for all messages in the failed batch
        // Note: All messages in the batch are treated as failed when batch processing fails
        for (const item of currentBatch) {
          await this.handleMessageRetry(item.amqpMessage, consumer, consumerName);
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
