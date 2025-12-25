import { AmqpClient, type Logger } from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type {
  ContractDefinition,
  ErrorHandlingStrategy,
  InferConsumerNames,
} from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import {
  HandlerError,
  MessageValidationError,
  NonRetryableError,
  RetryableError,
  TechnicalError,
} from "./errors.js";
import type { WorkerInferConsumerHandlers, WorkerInferConsumerInput } from "./types.js";
import type { ConsumeMessage } from "amqplib";

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
 *     processOrder: async (message) => {
 *       console.log('Processing order:', message.orderId);
 *     }
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
  /** Handlers for each consumer defined in the contract */
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
  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    private readonly handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly logger?: Logger,
  ) {}

  /**
   * Create a type-safe AMQP worker from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The worker will set up
   * consumers for all contract-defined handlers asynchronously in the background
   * once the underlying connection and channels are ready.
   *
   * @param options - Configuration options for the worker
   * @returns A Future that resolves to a Result containing the worker or an error
   *
   * @example
   * ```typescript
   * const workerResult = await TypedAmqpWorker.create({
   *   contract: myContract,
   *   handlers: {
   *     processOrder: async (msg) => console.log('Order:', msg.orderId)
   *   },
   *   urls: ['amqp://localhost']
   * }).resultToPromise();
   *
   * if (workerResult.isError()) {
   *   console.error('Failed to create worker:', workerResult.error);
   * }
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
    return Future.fromPromise(this.amqpClient.close())
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

    const consumerNames = Object.keys(this.contract.consumers) as InferConsumerNames<TContract>[];

    return Future.all(consumerNames.map((consumerName) => this.consume(consumerName)))
      .map(Result.all)
      .mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.amqpClient.channel.waitForConnect())
      .mapError((error) => new TechnicalError("Failed to wait for connection ready", error))
      .mapOk(() => undefined);
  }

  /**
   * Calculate the retry delay for a message using exponential backoff.
   * @param attemptNumber - The current attempt number (1-based)
   * @param initialDelayMs - The initial delay in milliseconds
   * @param multiplier - The exponential multiplier
   * @param maxDelayMs - The maximum delay in milliseconds
   * @returns The delay in milliseconds for this attempt
   */
  private calculateRetryDelay(
    attemptNumber: number,
    initialDelayMs: number,
    multiplier: number,
    maxDelayMs: number,
  ): number {
    const delay = initialDelayMs * Math.pow(multiplier, attemptNumber - 1);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Get the retry attempt number from message headers.
   * @param msg - The AMQP message
   * @returns The current attempt number (0 if not set)
   */
  private getRetryAttempt(msg: ConsumeMessage): number {
    const headers = msg.properties.headers || {};
    return (headers["x-retry-count"] as number) || 0;
  }

  /**
   * Handle message error based on error type and error handling strategy.
   * @param msg - The AMQP message
   * @param error - The error that occurred
   * @param consumerName - The name of the consumer
   * @param consumer - The consumer definition
   */
  private handleMessageError(
    msg: ConsumeMessage,
    error: unknown,
    consumerName: string,
    consumer: { errorHandling?: ErrorHandlingStrategy; queue: { name: string } },
  ): void {
    const errorHandling = consumer.errorHandling;

    // For validation errors and non-retryable errors
    const isNonRetryable =
      error instanceof MessageValidationError ||
      error instanceof NonRetryableError ||
      (error instanceof HandlerError && !error.retryable);

    // If no error handling configured
    if (!errorHandling) {
      // Validation errors should not be requeued (they will never succeed)
      // Other errors should be requeued (default behavior)
      const shouldRequeue = !isNonRetryable;
      this.amqpClient.channel.nack(msg, false, shouldRequeue);
      return;
    }

    // For validation errors and non-retryable errors, send to dead letter queue
    if (isNonRetryable) {
      this.logger?.error("Non-retryable error, sending to dead letter queue", {
        consumerName: String(consumerName),
        error,
      });

      // Publish to dead letter exchange and ack the original message
      this.amqpClient.channel
        .publish(
          errorHandling.deadLetterExchange.name,
          msg.fields.routingKey,
          msg.content,
          {
            ...msg.properties,
            headers: {
              ...(msg.properties.headers || {}),
              "x-error-type": error instanceof HandlerError ? error.name : "Unknown",
              "x-error-message": error instanceof Error ? error.message : String(error),
              "x-original-queue": consumer.queue.name,
              "x-failed-at": new Date().toISOString(),
            },
          },
        )
        .then(() => {
          this.amqpClient.channel.ack(msg);
        })
        .catch((publishError: unknown) => {
          this.logger?.error("Failed to publish to dead letter exchange", {
            consumerName: String(consumerName),
            error: publishError,
          });
          // Fallback: nack without requeue
          this.amqpClient.channel.nack(msg, false, false);
        });

      return;
    }

    // For retryable errors, handle retry logic
    if (
      error instanceof RetryableError ||
      (error instanceof HandlerError && error.retryable) ||
      errorHandling.retryQueue
    ) {
      const backoffConfig = errorHandling.exponentialBackoff || {};
      const initialDelayMs = backoffConfig.initialDelayMs ?? 1000;
      const multiplier = backoffConfig.multiplier ?? 2;
      const maxAttempts = backoffConfig.maxAttempts ?? 3;
      const maxDelayMs = backoffConfig.maxDelayMs ?? 60000;

      const attemptNumber = this.getRetryAttempt(msg) + 1;

      // If max attempts reached, send to dead letter queue
      if (attemptNumber > maxAttempts) {
        this.logger?.error("Max retry attempts reached, sending to dead letter queue", {
          consumerName: String(consumerName),
          attemptNumber,
          maxAttempts,
          error,
        });

        this.amqpClient.channel
          .publish(
            errorHandling.deadLetterExchange.name,
            msg.fields.routingKey,
            msg.content,
            {
              ...msg.properties,
              headers: {
                ...(msg.properties.headers || {}),
                "x-error-type": error instanceof HandlerError ? error.name : "Unknown",
                "x-error-message": error instanceof Error ? error.message : String(error),
                "x-original-queue": consumer.queue.name,
                "x-retry-count": attemptNumber - 1,
                "x-max-attempts-reached": true,
                "x-failed-at": new Date().toISOString(),
              },
            },
          )
          .then(() => {
            this.amqpClient.channel.ack(msg);
          })
          .catch((publishError: unknown) => {
            this.logger?.error("Failed to publish to dead letter exchange", {
              consumerName: String(consumerName),
              error: publishError,
            });
            this.amqpClient.channel.nack(msg, false, false);
          });

        return;
      }

      // Calculate delay for this retry attempt
      const delayMs = this.calculateRetryDelay(attemptNumber, initialDelayMs, multiplier, maxDelayMs);

      this.logger?.warn("Retryable error, scheduling retry with exponential backoff", {
        consumerName: String(consumerName),
        attemptNumber,
        maxAttempts,
        delayMs,
        error,
      });

      // If retry queue configured, publish to retry queue with TTL
      if (errorHandling.retryQueue) {
        this.amqpClient.channel
          .publish("", errorHandling.retryQueue.name, msg.content, {
            ...msg.properties,
            expiration: String(delayMs),
            headers: {
              ...(msg.properties.headers || {}),
              "x-retry-count": attemptNumber,
              "x-original-queue": consumer.queue.name,
              "x-original-routing-key": msg.fields.routingKey,
              "x-error-type": error instanceof HandlerError ? error.name : "Unknown",
              "x-error-message": error instanceof Error ? error.message : String(error),
            },
          })
          .then(() => {
            this.amqpClient.channel.ack(msg);
          })
          .catch((publishError: unknown) => {
            this.logger?.error("Failed to publish to retry queue", {
              consumerName: String(consumerName),
              error: publishError,
            });
            // Fallback: nack with requeue (default behavior)
            this.amqpClient.channel.nack(msg, false, true);
          });
      } else {
        // No retry queue configured, use default behavior (nack with requeue)
        this.amqpClient.channel.nack(msg, false, true);
      }

      return;
    }

    // Default: nack with requeue for unknown errors
    this.amqpClient.channel.nack(msg, false, true);
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

    const handler = this.handlers[consumerName];
    if (!handler) {
      return Future.value(
        Result.Error(new TechnicalError(`Handler for "${String(consumerName)}" not provided`)),
      );
    }

    // Start consuming
    return Future.fromPromise(
      this.amqpClient.channel.consume(consumer.queue.name, async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        // Parse message
        const parseResult = Result.fromExecution(() => JSON.parse(msg.content.toString()));
        if (parseResult.isError()) {
          this.logger?.error("Error parsing message", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            error: parseResult.error,
          });

          // Malformed JSON is non-retryable - send to dead letter queue or nack
          if (consumer.errorHandling) {
            this.amqpClient.channel
              .publish(
                consumer.errorHandling.deadLetterExchange.name,
                msg.fields.routingKey,
                msg.content,
                {
                  ...msg.properties,
                  headers: {
                    ...(msg.properties.headers || {}),
                    "x-error-type": "ParseError",
                    "x-error-message": parseResult.error instanceof Error ? parseResult.error.message : String(parseResult.error),
                    "x-original-queue": consumer.queue.name,
                    "x-failed-at": new Date().toISOString(),
                  },
                },
              )
              .then(() => {
                this.amqpClient.channel.ack(msg);
              })
              .catch(() => {
                this.amqpClient.channel.nack(msg, false, false);
              });
          } else {
            this.amqpClient.channel.nack(msg, false, false);
          }
          return;
        }

        const rawValidation = consumer.message.payload["~standard"].validate(parseResult.value);
        await Future.fromPromise(
          rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation),
        )
          .mapOkToResult((validationResult) => {
            if (validationResult.issues) {
              return Result.Error(
                new MessageValidationError(String(consumerName), validationResult.issues),
              );
            }

            return Result.Ok(validationResult.value as WorkerInferConsumerInput<TContract, TName>);
          })
          .tapError((error) => {
            this.logger?.error("Message validation failed", {
              consumerName: String(consumerName),
              queueName: consumer.queue.name,
              error,
            });

            // Handle validation error using error handling strategy
            this.handleMessageError(msg, error, String(consumerName), consumer);
          })
          .flatMapOk((validatedMessage) =>
            Future.fromPromise(handler(validatedMessage)).tapError((error) => {
              this.logger?.error("Error processing message", {
                consumerName: String(consumerName),
                queueName: consumer.queue.name,
                error,
              });

              // Handle processing error using error handling strategy
              this.handleMessageError(msg, error, String(consumerName), consumer);
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
      .mapError(
        (error) =>
          new TechnicalError(`Failed to start consuming for "${String(consumerName)}"`, error),
      )
      .mapOk(() => undefined);
  }
}
