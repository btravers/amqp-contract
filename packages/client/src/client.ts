import { connect } from "amqplib";
import type { Channel, ChannelModel, Options } from "amqplib";
import type { ContractDefinition, InferPublisherNames } from "@amqp-contract/contract";
import { setupInfra } from "@amqp-contract/core";
import { Future, Result } from "@swan-io/boxed";
import { MessageValidationError, TechnicalError } from "./errors.js";
import type { ClientInferPublisherInput } from "./types.js";

/**
 * Options for creating a TypedAmqpClient.
 *
 * @template TContract - The contract definition type
 */
export interface CreateClientOptions<TContract extends ContractDefinition> {
  /**
   * The AMQP contract definition containing publishers and infrastructure.
   * This contract defines all the exchanges, queues, and publishers that the client can use.
   */
  contract: TContract;

  /**
   * AMQP connection configuration.
   *
   * Can be either:
   * - A connection URL string (e.g., 'amqp://localhost' or 'amqps://user:pass@example.com:5671')
   * - An Options.Connect object for more advanced configuration
   *
   * @example
   * ```typescript
   * // Using connection URL
   * connection: 'amqp://localhost'
   *
   * // Using connection options
   * connection: {
   *   hostname: 'localhost',
   *   port: 5672,
   *   username: 'guest',
   *   password: 'guest',
   *   vhost: '/'
   * }
   * ```
   */
  connection: string | Options.Connect;
}

/**
 * Type-safe AMQP client for publishing messages.
 *
 * The TypedAmqpClient provides a type-safe interface for publishing messages to RabbitMQ.
 * All publishers defined in your contract are available as strongly-typed methods with
 * automatic schema validation.
 *
 * Features:
 * - **Type safety**: Publisher names and message types are inferred from your contract
 * - **Automatic validation**: Messages are validated against schemas before publishing
 * - **Infrastructure management**: Automatically creates exchanges, queues, and bindings
 * - **Error handling**: Uses Result types for explicit error handling
 *
 * @template TContract - The contract definition type
 *
 * @example
 * ```typescript
 * import { TypedAmqpClient } from '@amqp-contract/client';
 * import { defineContract, defineExchange, definePublisher, defineMessage } from '@amqp-contract/contract';
 * import { z } from 'zod';
 *
 * // Define your contract
 * const contract = defineContract({
 *   exchanges: {
 *     orders: defineExchange('orders', 'topic', { durable: true }),
 *   },
 *   publishers: {
 *     orderCreated: definePublisher(
 *       defineExchange('orders', 'topic', { durable: true }),
 *       defineMessage(z.object({
 *         orderId: z.string(),
 *         amount: z.number(),
 *       })),
 *       { routingKey: 'order.created' }
 *     ),
 *   },
 * });
 *
 * // Create the client
 * const clientResult = await TypedAmqpClient.create({
 *   contract,
 *   connection: 'amqp://localhost'
 * });
 *
 * if (clientResult.isOk()) {
 *   const client = clientResult.value;
 *
 *   // Publish a message (fully typed!)
 *   const result = await client.publish('orderCreated', {
 *     orderId: 'ORD-123',
 *     amount: 99.99
 *   });
 *
 *   if (result.isOk()) {
 *     console.log('Message published successfully');
 *   } else {
 *     console.error('Failed to publish:', result.error);
 *   }
 *
 *   // Close when done
 *   await client.close();
 * }
 * ```
 */
export class TypedAmqpClient<TContract extends ContractDefinition> {
  private channel: Channel | null = null;
  private connection: ChannelModel | null = null;

  private constructor(
    private readonly contract: TContract,
    private readonly connectionOptions: string | Options.Connect,
  ) {}

  /**
   * Create a type-safe AMQP client from a contract.
   *
   * This factory method:
   * 1. Connects to the AMQP broker
   * 2. Creates a channel
   * 3. Sets up all infrastructure (exchanges, queues, bindings) defined in the contract
   * 4. Returns a ready-to-use client wrapped in a Result
   *
   * @param options - Client creation options
   * @param options.contract - The AMQP contract definition
   * @param options.connection - AMQP connection URL or options
   * @returns A Future resolving to Result.Ok(client) or Result.Error(TechnicalError)
   *
   * @example
   * ```typescript
   * const clientResult = await TypedAmqpClient.create({
   *   contract: myContract,
   *   connection: 'amqp://localhost'
   * });
   *
   * if (clientResult.isOk()) {
   *   const client = clientResult.value;
   *   // Use the client...
   * } else {
   *   console.error('Failed to create client:', clientResult.error);
   * }
   * ```
   */
  static create<TContract extends ContractDefinition>({
    contract,
    connection,
  }: CreateClientOptions<TContract>): Future<Result<TypedAmqpClient<TContract>, TechnicalError>> {
    const client = new TypedAmqpClient(contract, connection);
    return client.init().mapOk(() => client);
  }

  /**
   * Publish a message using a defined publisher.
   *
   * This method:
   * 1. Validates the message against the publisher's schema
   * 2. Publishes the message to the exchange with the configured routing key
   * 3. Returns a Result indicating success or failure
   *
   * The message type is automatically inferred from the contract, providing full type safety.
   *
   * @template TName - The publisher name (inferred from contract)
   * @param publisherName - The name of the publisher defined in the contract
   * @param message - The message payload (typed based on the publisher's schema)
   * @param options - Optional AMQP publish options (e.g., persistent, expiration, priority)
   * @returns A Future resolving to:
   *   - Result.Ok(true) if the message was published successfully
   *   - Result.Error(MessageValidationError) if the message failed validation
   *   - Result.Error(TechnicalError) if publishing failed due to technical issues
   *
   * @example
   * ```typescript
   * // Type-safe publishing
   * const result = await client.publish('orderCreated', {
   *   orderId: 'ORD-123',
   *   amount: 99.99
   * });
   *
   * if (result.isOk()) {
   *   console.log('Message published successfully');
   * } else if (result.error instanceof MessageValidationError) {
   *   console.error('Invalid message:', result.error.issues);
   * } else {
   *   console.error('Technical error:', result.error.message);
   * }
   *
   * // With AMQP options
   * const persistentResult = await client.publish('orderCreated', {
   *   orderId: 'ORD-456',
   *   amount: 149.99
   * }, {
   *   persistent: true,
   *   expiration: '60000', // 60 seconds
   *   priority: 5
   * });
   * ```
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
  /**
   * Close the AMQP client connection and channel.
   *
   * This method gracefully shuts down the client by:
   * 1. Closing the AMQP channel
   * 2. Closing the AMQP connection
   * 3. Cleaning up internal state
   *
   * Always call this method when you're done using the client to properly release resources.
   *
   * @returns A Future resolving to:
   *   - Result.Ok(void) if the client was closed successfully
   *   - Result.Error(TechnicalError) if closing failed
   *
   * @example
   * ```typescript
   * const client = clientResult.value;
   *
   * // Use the client...
   * await client.publish('orderCreated', { ... });
   *
   * // Close when done
   * const closeResult = await client.close();
   * if (closeResult.isOk()) {
   *   console.log('Client closed successfully');
   * } else {
   *   console.error('Failed to close client:', closeResult.error);
   * }
   * ```
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
