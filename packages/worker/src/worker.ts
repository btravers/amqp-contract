import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import { AmqpClient } from "@amqp-contract/core";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { WorkerInferConsumerHandlers, WorkerInferConsumerInput } from "./types.js";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";

/**
 * Options for creating a worker
 */
export type CreateWorkerOptions<TContract extends ContractDefinition> = {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
};

/**
 * Type-safe AMQP worker for consuming messages
 */
export class TypedAmqpWorker<TContract extends ContractDefinition> {
  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    private readonly handlers: WorkerInferConsumerHandlers<TContract>,
  ) {}

  /**
   * Create a type-safe AMQP worker from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The worker will set up
   * consumers for all contract-defined handlers asynchronously in the background
   * once the underlying connection and channels are ready.
   */
  static create<TContract extends ContractDefinition>({
    contract,
    handlers,
    urls,
    connectionOptions,
  }: CreateWorkerOptions<TContract>): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>> {
    const worker = new TypedAmqpWorker(
      contract,
      new AmqpClient(contract, {
        urls,
        connectionOptions,
      }),
      handlers,
    );
    return worker.consumeAll().mapOk(() => worker);
  }

  /**
   * Close the channel and connection
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
        // Parse message
        const parseResult = Result.fromExecution(() => JSON.parse(msg.content.toString()));
        if (parseResult.isError()) {
          // fixme: define a proper logging mechanism
          // fixme: do not log just an error, use a proper logging mechanism
          console.error(
            new TechnicalError(
              `Error parsing message for consumer "${String(consumerName)}"`,
              parseResult.error,
            ),
          );

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
            // fixme: define a proper logging mechanism
            // fixme: do not log just an error, use a proper logging mechanism
            console.error(error);

            // fixme proper error handling strategy
            // Reject message with no requeue (validation failed)
            this.amqpClient.channel.nack(msg, false, false);
          })
          .flatMapOk((validatedMessage) =>
            Future.fromPromise(handler(validatedMessage)).tapError((error) => {
              // fixme: define a proper logging mechanism
              // fixme: do not log just an error, use a proper logging mechanism
              console.error(
                new TechnicalError(
                  `Error processing message for consumer "${String(consumerName)}"`,
                  error,
                ),
              );

              // fixme proper error handling strategy
              // Reject message and requeue (handler failed)
              this.amqpClient.channel.nack(msg, false, true);
            }),
          )
          .tapOk(() => {
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
