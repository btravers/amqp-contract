import type { Options } from "amqplib";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { ClientInferPublisherInput } from "./types.js";
import { AmqpClient } from "@amqp-contract/core";
import type { AmqpConnectionManagerOptions, ConnectionUrl } from "amqp-connection-manager";

/**
 * Options for creating a client
 */
export type CreateClientOptions<TContract extends ContractDefinition> = {
  contract: TContract;
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions;
};

/**
 * Type-safe AMQP client for publishing messages
 */
export class TypedAmqpClient<TContract extends ContractDefinition> {
  private constructor(
    private readonly contract: TContract,
    private readonly amqpClient: AmqpClient,
  ) {}

  /**
   * Create a type-safe AMQP client from a contract.
   *
   * Connection management (including automatic reconnection) is handled internally
   * by amqp-connection-manager via the {@link AmqpClient}. The client establishes
   * infrastructure asynchronously in the background once the connection is ready.
   */
  static create<TContract extends ContractDefinition>({
    contract,
    urls,
    connectionOptions,
  }: CreateClientOptions<TContract>): TypedAmqpClient<TContract> {
    const options: { urls: ConnectionUrl[]; connectionOptions?: AmqpConnectionManagerOptions } = { urls };
    if (connectionOptions !== undefined) {
      options.connectionOptions = connectionOptions;
    }
    return new TypedAmqpClient(contract, new AmqpClient(contract, options));
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

    const publishMessage = (validatedMessage: unknown) => {
      return Future.fromPromise(
        this.amqpClient.channel.publish(
          publisher.exchange.name,
          publisher.routingKey ?? "",
          validatedMessage,
          options,
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

          return Result.Ok(published);
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
}
