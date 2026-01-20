/* eslint-disable eslint/sort-imports */
import type { ContractDefinition } from "@amqp-contract/contract";
import type {
  AmqpConnectionManager,
  AmqpConnectionManagerOptions,
  ChannelWrapper,
  ConnectionUrl,
  CreateChannelOpts,
} from "amqp-connection-manager";
import type { Channel, ConsumeMessage, Options } from "amqplib";
import { Future, Result } from "@swan-io/boxed";
import { TechnicalError } from "./errors.js";
import { ConnectionManagerSingleton } from "./connection-manager.js";
import { setupAmqpTopology } from "./setup.js";

/**
 * Options for creating an AMQP client.
 *
 * @property urls - AMQP broker URL(s). Multiple URLs provide failover support.
 * @property connectionOptions - Optional connection configuration (heartbeat, reconnect settings, etc.).
 * @property channelOptions - Optional channel configuration options.
 */
export type AmqpClientOptions = {
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  channelOptions?: Partial<CreateChannelOpts> | undefined;
};

/**
 * Callback type for consuming messages.
 */
export type ConsumeCallback = (msg: ConsumeMessage | null) => void | Promise<void>;

/**
 * AMQP client that manages connections and channels with automatic topology setup.
 *
 * This class handles:
 * - Connection management with automatic reconnection via amqp-connection-manager
 * - Connection pooling and sharing across instances with the same URLs
 * - Automatic AMQP topology setup (exchanges, queues, bindings) from contract
 * - Channel creation with JSON serialization enabled by default
 *
 * All operations return `Future<Result<T, TechnicalError>>` for consistent error handling.
 *
 * @example
 * ```typescript
 * const client = new AmqpClient(contract, {
 *   urls: ['amqp://localhost'],
 *   connectionOptions: { heartbeatIntervalInSeconds: 30 }
 * });
 *
 * // Wait for connection
 * await client.waitForConnect().resultToPromise();
 *
 * // Publish a message
 * const result = await client.publish('exchange', 'routingKey', { data: 'value' }).resultToPromise();
 *
 * // Close when done
 * await client.close().resultToPromise();
 * ```
 */
export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  private readonly channelWrapper: ChannelWrapper;
  private readonly urls: ConnectionUrl[];
  private readonly connectionOptions?: AmqpConnectionManagerOptions;

  /**
   * Create a new AMQP client instance.
   *
   * The client will automatically:
   * - Get or create a shared connection using the singleton pattern
   * - Set up AMQP topology (exchanges, queues, bindings) from the contract
   * - Create a channel with JSON serialization enabled
   *
   * @param contract - The contract definition specifying the AMQP topology
   * @param options - Client configuration options
   */
  constructor(
    private readonly contract: ContractDefinition,
    options: AmqpClientOptions,
  ) {
    // Store for cleanup
    this.urls = options.urls;
    if (options.connectionOptions !== undefined) {
      this.connectionOptions = options.connectionOptions;
    }

    // Always use singleton to get/create connection
    const singleton = ConnectionManagerSingleton.getInstance();
    this.connection = singleton.getConnection(options.urls, options.connectionOptions);

    // Create default setup function that calls setupAmqpTopology
    const defaultSetup = (channel: Channel) => setupAmqpTopology(channel, this.contract);

    // Destructure setup from channelOptions to handle it separately
    const { setup: userSetup, ...otherChannelOptions } = options.channelOptions ?? {};

    // Merge user-provided channel options with defaults
    const channelOpts: CreateChannelOpts = {
      json: true,
      setup: defaultSetup,
      ...otherChannelOptions,
    };

    // If user provided a custom setup, wrap it to call both
    if (userSetup) {
      channelOpts.setup = async (channel: Channel) => {
        // First run the topology setup
        await defaultSetup(channel);
        // Then run user's setup - check arity to determine if it expects a callback
        if (userSetup.length === 2) {
          // Callback-based setup function
          await new Promise<void>((resolve, reject) => {
            (userSetup as (channel: Channel, callback: (error?: Error) => void) => void)(
              channel,
              (error?: Error) => {
                if (error) reject(error);
                else resolve();
              },
            );
          });
        } else {
          // Promise-based setup function
          await (userSetup as (channel: Channel) => Promise<void>)(channel);
        }
      };
    }

    this.channelWrapper = this.connection.createChannel(channelOpts);
  }

  /**
   * Get the underlying connection manager
   *
   * This method exposes the AmqpConnectionManager instance that this client uses.
   * The connection is automatically shared across all AmqpClient instances that
   * use the same URLs and connection options.
   *
   * @returns The AmqpConnectionManager instance used by this client
   */
  getConnection(): AmqpConnectionManager {
    return this.connection;
  }

  /**
   * Wait for the channel to be connected and ready.
   *
   * @returns A Future that resolves when the channel is connected
   */
  waitForConnect(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.channelWrapper.waitForConnect()).mapError(
      (error: unknown) => new TechnicalError("Failed to connect to AMQP broker", error),
    );
  }

  /**
   * Publish a message to an exchange.
   *
   * @param exchange - The exchange name
   * @param routingKey - The routing key
   * @param content - The message content (will be JSON serialized if json: true)
   * @param options - Optional publish options
   * @returns A Future with Result<boolean> - true if message was sent, false if channel buffer is full
   */
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer | unknown,
    options?: Options.Publish,
  ): Future<Result<boolean, TechnicalError>> {
    return Future.fromPromise(
      this.channelWrapper.publish(exchange, routingKey, content, options),
    ).mapError((error: unknown) => new TechnicalError("Failed to publish message", error));
  }

  /**
   * Start consuming messages from a queue.
   *
   * @param queue - The queue name
   * @param callback - The callback to invoke for each message
   * @param options - Optional consume options
   * @returns A Future with Result<string> - the consumer tag
   */
  consume(
    queue: string,
    callback: ConsumeCallback,
    options?: Options.Consume,
  ): Future<Result<string, TechnicalError>> {
    return Future.fromPromise(this.channelWrapper.consume(queue, callback, options))
      .mapError((error: unknown) => new TechnicalError("Failed to start consuming messages", error))
      .mapOk((reply: { consumerTag: string }) => reply.consumerTag);
  }

  /**
   * Cancel a consumer by its consumer tag.
   *
   * @param consumerTag - The consumer tag to cancel
   * @returns A Future that resolves when the consumer is cancelled
   */
  cancel(consumerTag: string): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.channelWrapper.cancel(consumerTag))
      .mapError((error: unknown) => new TechnicalError("Failed to cancel consumer", error))
      .mapOk(() => undefined);
  }

  /**
   * Acknowledge a message.
   *
   * @param msg - The message to acknowledge
   * @param allUpTo - If true, acknowledge all messages up to and including this one
   */
  ack(msg: ConsumeMessage, allUpTo = false): void {
    this.channelWrapper.ack(msg, allUpTo);
  }

  /**
   * Negative acknowledge a message.
   *
   * @param msg - The message to nack
   * @param allUpTo - If true, nack all messages up to and including this one
   * @param requeue - If true, requeue the message(s)
   */
  nack(msg: ConsumeMessage, allUpTo = false, requeue = true): void {
    this.channelWrapper.nack(msg, allUpTo, requeue);
  }

  /**
   * Add a setup function to be called when the channel is created or reconnected.
   *
   * This is useful for setting up channel-level configuration like prefetch.
   *
   * @param setup - The setup function to add
   */
  addSetup(setup: (channel: Channel) => void | Promise<void>): void {
    this.channelWrapper.addSetup(setup);
  }

  /**
   * Register an event listener on the channel wrapper.
   *
   * Available events:
   * - 'connect': Emitted when the channel is (re)connected
   * - 'close': Emitted when the channel is closed
   * - 'error': Emitted when an error occurs
   *
   * @param event - The event name
   * @param listener - The event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.channelWrapper.on(event, listener);
  }

  /**
   * Close the channel and release the connection reference.
   *
   * This will:
   * - Close the channel wrapper
   * - Decrease the reference count on the shared connection
   * - Close the connection if this was the last client using it
   *
   * @returns A Future that resolves when the channel and connection are closed
   */
  close(): Future<Result<void, TechnicalError>> {
    return Future.fromPromise(this.channelWrapper.close())
      .mapError((error: unknown) => new TechnicalError("Failed to close channel", error))
      .flatMapOk(() =>
        Future.fromPromise(
          ConnectionManagerSingleton.getInstance().releaseConnection(
            this.urls,
            this.connectionOptions,
          ),
        ).mapError((error: unknown) => new TechnicalError("Failed to release connection", error)),
      )
      .mapOk(() => undefined);
  }

  /**
   * Reset connection singleton cache (for testing only)
   * @internal
   */
  static async _resetConnectionCacheForTesting(): Promise<void> {
    await ConnectionManagerSingleton.getInstance()._resetForTesting();
  }
}
