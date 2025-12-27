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

export type AmqpClientOptions = {
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
  channelOptions?: Partial<CreateChannelOpts> | undefined;
};

export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  public readonly channel: ChannelWrapper;
  private readonly urls: ConnectionUrl[];
  private readonly connectionOptions?: AmqpConnectionManagerOptions;

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

    // Merge user-provided channel options with defaults
    const channelOpts: CreateChannelOpts = {
      json: true,
      setup: defaultSetup,
      ...options.channelOptions,
    };

    // If user provided a custom setup, wrap it to call both
    if (options.channelOptions?.setup) {
      const userSetup = options.channelOptions.setup;
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
          const result = (userSetup as (channel: Channel) => Promise<void>)(channel);
          await result;
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
