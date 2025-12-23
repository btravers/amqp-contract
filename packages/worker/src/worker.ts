import { connect } from "amqplib";
import type { Channel, ChannelModel, ConsumeMessage, Options } from "amqplib";
import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import { setupInfra } from "@amqp-contract/core";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { WorkerInferConsumerHandlers, WorkerInferConsumerInput } from "./types.js";

/**
 * Options for creating a worker
 */
export interface CreateWorkerOptions<TContract extends ContractDefinition> {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  connection: string | Options.Connect;
}

/**
 * Type-safe AMQP worker for consuming messages
 */
export class TypedAmqpWorker<TContract extends ContractDefinition> {
  private channel: Channel | null = null;
  private connection: ChannelModel | null = null;
  private consumerTags: string[] = [];

  private constructor(
    private readonly contract: TContract,
    private readonly handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly connectionOptions: string | Options.Connect,
  ) {}

  /**
   * Create a type-safe AMQP worker from a contract
   * The worker will automatically connect and start consuming all messages
   */
  static create<TContract extends ContractDefinition>(
    options: CreateWorkerOptions<TContract>,
  ): Future<Result<TypedAmqpWorker<TContract>, TechnicalError>> {
    const worker = new TypedAmqpWorker(options.contract, options.handlers, options.connection);

    return Future.concurrent([worker.init(), worker.consumeAll()], { concurrency: 1 })
      .map((results) => Result.all([...results]))
      .mapOk(() => worker);
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.stopConsuming();

    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  /**
   * Connect to AMQP broker
   */
  private init(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(connect(this.connectionOptions))
      .mapError((error) => new TechnicalError("Failed to connect to AMQP broker", error))
      .tapOk((connection) => {
        this.connection = connection;
      })
      .flatMapOk(() =>
        Future.fromPromise(this.connection!.createChannel())
          .mapError((error) => new TechnicalError("Failed to create AMQP channel", error))
          .tapOk((channel) => {
            this.channel = channel;
          }),
      )
      .flatMapOk(() =>
        Future.fromPromise(setupInfra(this.channel!, this.contract)).mapError(
          (error) => new TechnicalError("Failed to setup AMQP infrastructure", error),
        ),
      )
      .mapOk(() => undefined);
  }

  /**
   * Start consuming messages for all consumers
   */
  private consumeAll(): Future<Result<void, TechnicalError>> {
    if (!this.contract.consumers) {
      return Future.value(
        Result.Error(new TechnicalError("No consumers defined in contract")),
      );
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
    const channel = this.channel;
    if (!channel) {
      return Future.value(
        Result.Error(
          new TechnicalError(
            "Worker not initialized. Use TypedAmqpWorker.create() to obtain an initialized worker instance.",
          ),
        ),
      );
    }

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
      channel.consume(
        consumer.queue.name,
        (msg: ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

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
            channel.nack(msg, false, false);
            return;
          }

          const rawValidation = consumer.message.payload["~standard"].validate(parseResult.value);
          Future.fromPromise(
            rawValidation instanceof Promise ? rawValidation : Promise.resolve(rawValidation),
          )
            .mapOkToResult((validationResult) => {
              if (validationResult.issues) {
                return Result.Error(
                  new MessageValidationError(String(consumerName), validationResult.issues),
                );
              }

              return Result.Ok(
                validationResult.value as WorkerInferConsumerInput<TContract, TName>,
              );
            })
            .tapError((error) => {
              // fixme: define a proper logging mechanism
              // fixme: do not log just an error, use a proper logging mechanism
              console.error(error);

              // fixme proper error handling strategy
              // Reject message with no requeue (validation failed)
              channel.nack(msg, false, false);
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
                channel.nack(msg, false, true);
              }),
            )
            .tapOk(() => {
              if (!consumer.noAck) {
                channel.ack(msg);
              }
            });
        },
        {
          noAck: consumer.noAck ?? false,
        },
      ),
    )
      .mapError(
        (error) =>
          new TechnicalError(`Failed to start consuming for "${String(consumerName)}"`, error),
      )
      .tapOk((result) => {
        this.consumerTags.push(result.consumerTag);
      })
      .mapOk(() => undefined);
  }

  /**
   * Stop consuming messages
   */
  private stopConsuming(): Future<Result<void, TechnicalError>> {
    const channel = this.channel;
    if (!channel) {
      return Future.value(Result.Ok(undefined));
    }

    return Future.all(
      this.consumerTags.map((tag) =>
        Future.fromPromise(channel.cancel(tag)).mapError(
          (error) => new TechnicalError(`Failed to cancel consumer "${tag}"`, error),
        ),
      ),
    )
      .map((results) => Result.all(results))
      .tapOk(() => {
        this.consumerTags = [];
      })
      .mapOk(() => undefined);
  }
}
