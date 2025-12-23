import { connect } from "amqplib";
import type { Channel, ChannelModel, Options } from "amqplib";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import { setupInfra } from "@amqp-contract/core";
import { Future, Result } from "@swan-io/boxed";
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
  static async create<TContract extends ContractDefinition>({
    contract,
    connection,
  }: CreateClientOptions<TContract>): Promise<TypedAmqpClient<TContract>> {
    const client = new TypedAmqpClient(contract, connection);
    const initResult = await client.init().toPromise();
    if (Result.isError(initResult)) {
      throw initResult.error;
    }
    return client;
  }

  /**
   * Publish a message using a defined publisher
   * Returns Result.Ok(true) on success, or Result.Error with specific error on failure
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: Options.Publish,
  ): Future<Result<boolean, TechnicalError | MessageValidationError>> {
    const channel = this.channel;
    if (!channel) {
      return Future.value(
        Result.Error(
          new TechnicalError(
            "Client not initialized. Create the client using TypedAmqpClient.create() to establish a connection.",
          ),
        ),
      );
    }

    const publishers = this.contract.publishers;
    if (!publishers) {
      return Future.value(Result.Error(new TechnicalError("No publishers defined in contract")));
    }

    const publisher = publishers[publisherName as string];
    if (!publisher) {
      return Future.value(
        Result.Error(
          new TechnicalError(`Publisher "${String(publisherName)}" not found in contract`),
        ),
      );
    }

    const validateMessage = () =>
      Future.fromPromise(publisher.message.payload["~standard"].validate(message))
        .mapError((error) => new TechnicalError(`Validation failed`, error))
        .mapOkToResult((validation) => {
          if (validation.issues) {
            return Result.Error(
              new MessageValidationError(String(publisherName), validation.issues),
            );
          }

          return Result.Ok(validation.value);
        });

    const publishMessage = (validatedMessage: unknown) => {
      const routingKey = publisher.routingKey ?? "";
      const content = Buffer.from(JSON.stringify(validatedMessage));

      return Result.fromExecution(() =>
        channel.publish(publisher.exchange.name, routingKey, content, options),
      )
        .mapError((error) => new TechnicalError(`Failed to publish message`, error))
        .flatMap((published) => {
          if (!published) {
            return Result.Error(
              new TechnicalError(
                `Failed to publish message for publisher "${String(publisherName)}": Channel rejected the message (buffer full or other channel issue)`,
              ),
            );
          }

          return Result.Ok(published);
        });
    };

    // Validate message using schema
    return validateMessage().mapOkToResult((validatedMessage) => publishMessage(validatedMessage));
  }

  /**
   * Close the channel and connection
   */
  close(): Future<Result<void, TechnicalError>> {
    const closeChannel = () =>
      Future.fromPromise(this.channel ? this.channel.close() : Promise.resolve()).mapError(
        (error) => new TechnicalError("Failed to close channel", error),
      );

    const closeConnection = () =>
      Future.fromPromise(this.connection ? this.connection.close() : Promise.resolve()).mapError(
        (error) => new TechnicalError("Failed to close connection", error),
      );

    return Future.concurrent([closeChannel, closeConnection], { concurrency: 1 })
      .map((results) => Result.all([...results]))
      .mapOk(() => {
        this.channel = null;
        this.connection = null;
        return undefined;
      });
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
}
