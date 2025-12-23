import { connect } from "amqplib";
import type { Channel, ChannelModel, ConsumeMessage, Options } from "amqplib";
import type { ContractDefinition, InferConsumerNames } from "@amqp-contract/contract";
import { setupInfra } from "@amqp-contract/core";
import { Result } from "@swan-io/boxed";
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
  static async create<TContract extends ContractDefinition>(
    options: CreateWorkerOptions<TContract>,
  ): Promise<TypedAmqpWorker<TContract>> {
    const worker = new TypedAmqpWorker(options.contract, options.handlers, options.connection);
    await worker.init();
    await worker.consumeAll();
    return worker;
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
  private async init(): Promise<void> {
    this.connection = await connect(this.connectionOptions);
    this.channel = await this.connection.createChannel();

    // Setup exchanges, queues, and bindings
    await setupInfra(this.channel, this.contract);
  }

  /**
   * Start consuming messages for all consumers
   */
  private async consumeAll(): Promise<void> {
    if (!this.contract.consumers) {
      throw new Error("No consumers defined in contract");
    }

    const consumerNames = Object.keys(this.contract.consumers) as InferConsumerNames<TContract>[];

    for (const consumerName of consumerNames) {
      await this.consume(consumerName);
    }
  }

  /**
   * Start consuming messages for a specific consumer
   */
  private async consume<TName extends InferConsumerNames<TContract>>(
    consumerName: TName,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error(
        "Worker not initialized. Use TypedAmqpWorker.create() to obtain an initialized worker instance.",
      );
    }

    const consumers = this.contract.consumers as Record<string, unknown>;
    if (!consumers) {
      throw new Error("No consumers defined in contract");
    }

    const consumer = consumers[consumerName as string];
    if (!consumer || typeof consumer !== "object") {
      const availableConsumers = Object.keys(consumers);
      const available = availableConsumers.length > 0 ? availableConsumers.join(", ") : "none";
      throw new Error(
        `Consumer not found: "${String(consumerName)}". Available consumers: ${available}`,
      );
    }

    const consumerDef = consumer as {
      queue: { name: string };
      message: { payload: { "~standard": { validate: (value: unknown) => unknown } } };
      prefetch?: number;
      noAck?: boolean;
    };

    const handler = this.handlers[consumerName];
    if (!handler) {
      throw new Error(`Handler for "${String(consumerName)}" not provided`);
    }

    // Set prefetch if specified
    if (consumerDef.prefetch !== undefined) {
      await this.channel.prefetch(consumerDef.prefetch);
    }

    // Start consuming
    const result = await this.channel.consume(
      consumerDef.queue.name,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        // Parse message
        const parseResult = Result.fromExecution(() => JSON.parse(msg.content.toString()));

        if (parseResult.isError()) {
          console.error(
            new TechnicalError(
              `Error parsing message for consumer "${String(consumerName)}"`,
              parseResult.error,
            ),
          );
          // Reject message with no requeue (malformed JSON)
          this.channel?.nack(msg, false, false);
          return;
        }

        const content = parseResult.value;

        // Validate message using schema (supports sync and async validators)
        const rawValidation = consumerDef.message.payload["~standard"].validate(content);
        const resolvedValidation =
          rawValidation instanceof Promise ? await rawValidation : rawValidation;
        const validationResult: Result<unknown, MessageValidationError> =
          typeof resolvedValidation === "object" &&
          resolvedValidation !== null &&
          "issues" in resolvedValidation &&
          resolvedValidation.issues
            ? Result.Error(
                new MessageValidationError(String(consumerName), resolvedValidation.issues),
              )
            : Result.Ok(
                typeof resolvedValidation === "object" &&
                  resolvedValidation !== null &&
                  "value" in resolvedValidation
                  ? resolvedValidation.value
                  : content,
              );

        if (validationResult.isError()) {
          console.error(validationResult.error);
          // Reject message with no requeue (validation failed)
          this.channel?.nack(msg, false, false);
          return;
        }

        const validatedMessage = validationResult.value as WorkerInferConsumerInput<
          TContract,
          TName
        >;

        // Call handler and wait for Promise to resolve
        try {
          await handler(validatedMessage);

          // Acknowledge message if not in noAck mode
          if (!consumerDef.noAck) {
            this.channel?.ack(msg);
          }
        } catch (error) {
          console.error(
            new TechnicalError(
              `Error processing message for consumer "${String(consumerName)}"`,
              error,
            ),
          );
          // Reject message and requeue (handler failed)
          this.channel?.nack(msg, false, true);
        }
      },
      {
        noAck: consumerDef.noAck ?? false,
      },
    );

    this.consumerTags.push(result.consumerTag);
  }

  /**
   * Stop consuming messages
   */
  private async stopConsuming(): Promise<void> {
    if (!this.channel) {
      return;
    }

    for (const tag of this.consumerTags) {
      await this.channel.cancel(tag);
    }

    this.consumerTags = [];
  }
}
