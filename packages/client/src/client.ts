import { connect } from "amqplib";
import type { Channel, ChannelModel, Options } from "amqplib";
import type {
  ContractDefinition,
  InferPublisherNames,
} from "@amqp-contract/contract";
import { setupInfra } from "@amqp-contract/core";
import { Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { ClientInferPublisherInput } from "./types.js";

/**
 * Options for creating a client
 */
export interface CreateClientOptions<TContract extends ContractDefinition> {
  contract: TContract;
  connection: string | Options.Connect;
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
  private connection: ChannelModel | null = null;

  private constructor(
    private readonly contract: TContract,
    private readonly connectionOptions: string | Options.Connect,
  ) {}

  /**
   * Create a type-safe AMQP client from a contract
   * The client will automatically connect to the AMQP broker
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
   * Returns Result.Ok(true) on success, or Result.Error with specific error on failure
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: PublishOptions,
  ): Result<boolean, TechnicalError | MessageValidationError> {
    if (!this.channel) {
      throw new Error(
        "Client not initialized. Create the client using TypedAmqpClient.create() to establish a connection.",
      );
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
      exchange: { name: string; type: string };
      routingKey?: string;
      message: { payload: { "~standard": { validate: (value: unknown) => unknown } } };
    };

    // Validate message using schema
    const validation = publisherDef.message.payload["~standard"].validate(message);
    if (
      typeof validation === "object" &&
      validation !== null &&
      "issues" in validation &&
      validation.issues
    ) {
      return Result.Error(new MessageValidationError(String(publisherName), validation.issues));
    }

    const validatedMessage =
      typeof validation === "object" && validation !== null && "value" in validation
        ? validation.value
        : message;

    // Publish message
    const routingKey = options?.routingKey ?? publisherDef.routingKey ?? "";
    const content = Buffer.from(JSON.stringify(validatedMessage));

    const published = this.channel.publish(
      publisherDef.exchange.name,
      routingKey,
      content,
      options?.options,
    );

    if (!published) {
      return Result.Error(
        new TechnicalError(
          `Failed to publish message for publisher "${String(publisherName)}": Channel rejected the message (buffer full or other channel issue)`,
        ),
      );
    }

    return Result.Ok(published);
  }

  /**
   * Close the channel and connection
   */
  async close(): Promise<void> {
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
}
