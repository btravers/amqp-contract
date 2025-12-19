import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import type {
  ContractDefinition,
  InferConsumerNames,
  WorkerInferConsumerHandlers,
} from "@amqp-contract/contract";

/**
 * Options for creating a worker
 */
export interface CreateWorkerOptions<TContract extends ContractDefinition> {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  connection: ChannelModel;
}

/**
 * Type-safe AMQP worker for consuming messages
 */
export class TypedAmqpWorker<TContract extends ContractDefinition> {
  private channel: Channel | null = null;
  private consumerTags: string[] = [];

  private constructor(
    private readonly contract: TContract,
    private readonly handlers: WorkerInferConsumerHandlers<TContract>,
    private readonly connection: ChannelModel,
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
    }

    await this.connection.close();
  }

  /**
   * Connect to AMQP broker
   */
  private async init(): Promise<void> {
    this.channel = await this.connection.createChannel();

    // Setup exchanges
    if (this.contract.exchanges) {
      for (const exchange of Object.values(this.contract.exchanges)) {
        await this.channel.assertExchange(exchange.name, exchange.type, {
          durable: exchange.durable,
          autoDelete: exchange.autoDelete,
          internal: exchange.internal,
          arguments: exchange.arguments,
        });
      }
    }

    // Setup queues
    if (this.contract.queues) {
      for (const queue of Object.values(this.contract.queues)) {
        await this.channel.assertQueue(queue.name, {
          durable: queue.durable,
          exclusive: queue.exclusive,
          autoDelete: queue.autoDelete,
          arguments: queue.arguments,
        });
      }
    }

    // Setup bindings
    if (this.contract.bindings) {
      for (const binding of Object.values(this.contract.bindings)) {
        await this.channel.bindQueue(
          binding.queue,
          binding.exchange,
          binding.routingKey ?? "",
          binding.arguments,
        );
      }
    }
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
      throw new Error(`Consumer "${String(consumerName)}" not found in contract`);
    }

    const consumerDef = consumer as {
      queue: string;
      message: { "~standard": { validate: (value: unknown) => unknown } };
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
      consumerDef.queue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          // Parse message
          const content = JSON.parse(msg.content.toString());

          // Validate message using schema
          const validation = consumerDef.message["~standard"].validate(content);
          if (
            typeof validation === "object" &&
            validation !== null &&
            "issues" in validation &&
            validation.issues
          ) {
            console.error("Message validation failed:", validation.issues);
            // Reject message with no requeue
            this.channel?.nack(msg, false, false);
            return;
          }

          const validatedMessage =
            typeof validation === "object" && validation !== null && "value" in validation
              ? validation.value
              : content;

          // Call handler
          await handler(validatedMessage);

          // Acknowledge message if not in noAck mode
          if (!consumerDef.noAck) {
            this.channel?.ack(msg);
          }
        } catch (error) {
          console.error("Error processing message:", error);
          // Reject message and requeue
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
