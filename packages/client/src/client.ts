import { AmqpClient, type Logger } from "@amqp-contract/core";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";
import type { Options } from "amqplib";
import { Future, Result } from "@swan-io/boxed";
import { compressBuffer, getContentEncoding } from "./compression.js";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { ClientInferPublisherInput } from "./types.js";

/**
 * Options for creating a client
 */
export type CreateClientOptions<TContract extends ContractDefinition> = {
  contract: TContract;
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  logger?: Logger | undefined;
};

/**
 * Type-safe AMQP client for publishing messages
 */
export class TypedAmqpClient<TContract extends ContractDefinition> {
  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
    private readonly logger?: Logger,
  ) {}

  /**
   * Create a type-safe AMQP client from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The client establishes
   * infrastructure asynchronously in the background once the connection is ready.
   *
   * Connections are automatically shared across clients with the same URLs and
   * connection options, following RabbitMQ best practices.
   */
  static create<TContract extends ContractDefinition>({
    contract,
    urls,
    connectionOptions,
    logger,
  }: CreateClientOptions<TContract>): Future<Result<TypedAmqpClient<TContract>, TechnicalError>> {
    const client = new TypedAmqpClient(
      contract,
      new AmqpClient(contract, { urls, connectionOptions }),
      logger,
    );

    return client.waitForConnectionReady().mapOk(() => client);
  }

  /**
   * Publish a message using a defined publisher
   * Returns Result.Ok(true) on success, or Result.Error with specific error on failure
   */
  publish<TName extends InferPublisherNames<TContract>>(
    publisherName: TName,
    message: ClientInferPublisherInput<TContract, TName>,
    options?: Options.Publish,
  ): Future<Result<void, TechnicalError | MessageValidationError>> {
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

    const validateMessage = () => {
      const validationResult = publisher.message.payload["~standard"].validate(message);
      return Future.fromPromise(
        validationResult instanceof Promise ? validationResult : Promise.resolve(validationResult),
      )
        .mapError((error) => new TechnicalError(`Validation failed`, error))
        .mapOkToResult((validation) => {
          if (validation.issues) {
            return Result.Error(
              new MessageValidationError(String(publisherName), validation.issues),
            );
          }

          return Result.Ok(validation.value);
        });
    };

    const publishMessage = (validatedMessage: unknown): Future<Result<void, TechnicalError>> => {
      const compressionAlgorithm = publisher.compression;
      const publishOptions: Options.Publish = { ...options };

      // Apply compression if configured
      if (compressionAlgorithm) {
        // For compression, manually serialize and compress the message
        const messageBuffer = Buffer.from(JSON.stringify(validatedMessage));

        return Future.fromPromise(compressBuffer(messageBuffer, compressionAlgorithm))
          .mapError((error) => new TechnicalError(`Failed to compress message`, error))
          .flatMapOk((compressedBuffer) => {
            // Set content-encoding header to indicate compression
            publishOptions.contentEncoding = getContentEncoding(compressionAlgorithm);

            return Future.fromPromise(
              this.amqpClient.channel.publish(
                publisher.exchange.name,
                publisher.routingKey ?? "",
                compressedBuffer,
                publishOptions,
              ),
            )
              .mapError((error) => new TechnicalError(`Failed to publish message`, error))
              .mapOkToResult((published) => {
                if (!published) {
                  return Result.Error(
                    new TechnicalError(
                      `Failed to publish message for publisher "${String(publisherName)}": Channel rejected the message (buffer full or other channel issue)`,
                    ),
                  );
                }

                this.logger?.info("Message published successfully", {
                  publisherName: String(publisherName),
                  exchange: publisher.exchange.name,
                  routingKey: publisher.routingKey,
                  compressed: true,
                });

                return Result.Ok(undefined);
              });
          });
      }

      // No compression: use the channel's built-in JSON serialization
      return Future.fromPromise(
        this.amqpClient.channel.publish(
          publisher.exchange.name,
          publisher.routingKey ?? "",
          validatedMessage,
          publishOptions,
        ),
      )
        .mapError((error) => new TechnicalError(`Failed to publish message`, error))
        .mapOkToResult((published) => {
          if (!published) {
            return Result.Error(
              new TechnicalError(
                `Failed to publish message for publisher "${String(publisherName)}": Channel rejected the message (buffer full or other channel issue)`,
              ),
            );
          }

          this.logger?.info("Message published successfully", {
            publisherName: String(publisherName),
            exchange: publisher.exchange.name,
            routingKey: publisher.routingKey,
            compressed: false,
          });

          return Result.Ok(undefined);
        });
    };

    // Validate message using schema
    return validateMessage().flatMapOk((validatedMessage) => publishMessage(validatedMessage));
  }

  /**
   * Close the channel and connection
   */
  close(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.amqpClient.close())
      .mapError((error) => new TechnicalError("Failed to close AMQP connection", error))
      .mapOk(() => undefined);
  }

  private waitForConnectionReady(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.amqpClient.channel.waitForConnect()).mapError(
      (error) => new TechnicalError("Failed to wait for connection ready", error),
    );
  }
}
