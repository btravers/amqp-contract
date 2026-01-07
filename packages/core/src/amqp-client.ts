import type {
  AmqpConnectionManager,
  AmqpConnectionManagerOptions,
  ChannelWrapper,
  ConnectionUrl,
  CreateChannelOpts,
} from "amqp-connection-manager";
import type { Channel } from "amqplib";
import { ConnectionManagerSingleton } from "./connection-manager.js";
import type { ContractDefinition } from "@amqp-contract/contract";
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
 * AMQP client that manages connections and channels with automatic topology setup.
 *
 * This class handles:
 * - Connection management with automatic reconnection via amqp-connection-manager
 * - Connection pooling and sharing across instances with the same URLs
 * - Automatic AMQP topology setup (exchanges, queues, bindings) from contract
 * - Channel creation with JSON serialization enabled by default
 *
 * @example
 * ```typescript
 * const client = new AmqpClient(contract, {
 *   urls: ['amqp://localhost'],
 *   connectionOptions: { heartbeatIntervalInSeconds: 30 }
 * });
 *
 * // Use the channel to publish messages
 * await client.channel.publish('exchange', 'routingKey', { data: 'value' });
 *
 * // Close when done
 * await client.close();
 * ```
 */
export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  public readonly channel: ChannelWrapper;
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

    this.channel = this.connection.createChannel(channelOpts);
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
   * Close the channel and release the connection reference.
   *
   * This will:
   * - Close the channel wrapper
   * - Decrease the reference count on the shared connection
   * - Close the connection if this was the last client using it
   *
   * @returns A promise that resolves when the channel and connection are closed
   */
  async close(): Promise<void> {
    await this.channel.close();
    // Release connection reference - will close connection if this was the last reference
    const singleton = ConnectionManagerSingleton.getInstance();
    await singleton.releaseConnection(this.urls, this.connectionOptions);
  }

  /**
   * Reset connection singleton cache (for testing only)
   * @internal
   */
  static async _resetConnectionCacheForTesting(): Promise<void> {
    await ConnectionManagerSingleton.getInstance()._resetForTesting();
  }
}
