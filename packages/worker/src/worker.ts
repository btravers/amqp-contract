import { AmqpClient, type Logger } from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { WorkerInferConsumerHandlers, WorkerInferConsumerInput } from "./types.js";

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
   * Connections are automatically shared across clients and workers with the same
   * URLs and connection options, following RabbitMQ best practices.
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

    const handler = this.handlers[consumerName];
    if (!handler) {
      return Future.value(
        Result.Error(new TechnicalError(`Handler for "${String(consumerName)}" not provided`)),
      );
    }

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

        // Parse message
        const parseResult = Result.fromExecution(() => JSON.parse(msg.content.toString()));
        if (parseResult.isError()) {
          this.logger?.error("Error parsing message", {
            consumerName: String(consumerName),
            queueName: consumer.queue.name,
            error: parseResult.error,
          });

          // fixme proper error handling strategy
          // Reject message with no requeue (malformed JSON)
          this.amqpClient.channel.nack(msg, false, false);
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

            // fixme proper error handling strategy
            // Reject message with no requeue (validation failed)
            this.amqpClient.channel.nack(msg, false, false);
          })
          .flatMapOk((validatedMessage) =>
            Future.fromPromise(handler(validatedMessage)).tapError((error) => {
              this.logger?.error("Error processing message", {
                consumerName: String(consumerName),
                queueName: consumer.queue.name,
                error,
              });

              // fixme proper error handling strategy
              // Reject message and requeue (handler failed)
              this.amqpClient.channel.nack(msg, false, true);
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
