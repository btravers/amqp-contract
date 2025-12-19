import type { Channel, ChannelModel, Options } from "amqplib";
import type {
  ClientInferPublisherInput,
  ContractDefinition,
  InferPublisherNames,
} from "@amqp-contract/contract";

/**
 * Options for creating a client
 */
export interface CreateClientOptions<TContract extends ContractDefinition> {
  contract: TContract;
  connection: ChannelModel;
}

/**
 * Options for publishing a message
 */
export interface PublishOptions {
  routingKey?: string;
  options?: Options.Publish;
}

/**
 * Type-safe AMQP client for publishing messages
 */
export class TypedAmqpClient<TContract extends ContractDefinition> {
  private channel: Channel | null = null;

  private constructor(
    private readonly contract: TContract,
    private readonly connection: ChannelModel,
  ) {}

  /**
   * Create a type-safe AMQP client from a contract
   * The client will automatically init to the AMQP broker
   */
  static async create<TContract extends ContractDefinition>(
    options: CreateClientOptions<TContract>,
  ): Promise<TypedAmqpClient<TContract>> {
    const client = new TypedAmqpClient(options.contract, options.connection);
    await client.init();
    return client;
  }

  /**
   * Publish a message using a defined publisher
   */
  async publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions,
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error("Client not connected. Call init() first.");
    }

    const publishers = this.contract.publishers as Record<string, unknown>;
    if (!publishers) {
      throw new Error("No publishers defined in contract");
    }

    const publisher = publishers[publisherName as string];
    if (!publisher || typeof publisher !== "object") {
      throw new Error(`Publisher "${String(publisherName)}" not found in contract`);
    }

    const publisherDef = publisher as {
      exchange: string;
      routingKey?: string;
      message: { "~standard": { validate: (value: unknown) => unknown } };
    };

    // Validate message using schema
    const validation = publisherDef.message["~standard"].validate(message);
    if (
      typeof validation === "object" &&
      validation !== null &&
      "issues" in validation &&
      validation.issues
    ) {
      throw new Error(`Message validation failed: ${JSON.stringify(validation.issues)}`);
    }

    const validatedMessage =
      typeof validation === "object" && validation !== null && "value" in validation
        ? validation.value
        : message;

    // Publish message
    const routingKey = options?.routingKey ?? publisherDef.routingKey ?? "";
    const content = Buffer.from(JSON.stringify(validatedMessage));

    return this.channel.publish(publisherDef.exchange, routingKey, content, options?.options);
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
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
}
