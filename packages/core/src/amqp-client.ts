import amqp, {
  AmqpConnectionManager,
  AmqpConnectionManagerOptions,
  ChannelWrapper,
  ConnectionUrl,
} from "amqp-connection-manager";
import type { Channel } from "amqplib";
import type { ContractDefinition } from "@amqp-contract/contract";

export type AmqpClientOptions = {
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions | undefined;
};

/**
 * Connection manager singleton for sharing connections across clients
 */
class ConnectionManagerSingleton {
  private static instance: ConnectionManagerSingleton;
  private connections: Map<string, AmqpConnectionManager> = new Map();

  private constructor() {}

  static getInstance(): ConnectionManagerSingleton {
    if (!ConnectionManagerSingleton.instance) {
      ConnectionManagerSingleton.instance = new ConnectionManagerSingleton();
    }
    return ConnectionManagerSingleton.instance;
  }

  /**
   * Get or create a connection for the given URLs and options
   */
  getConnection(
    urls: ConnectionUrl[],
    connectionOptions?: AmqpConnectionManagerOptions,
  ): AmqpConnectionManager {
    // Create a key based on URLs and connection options
    const key = this.createConnectionKey(urls, connectionOptions);
    
    if (!this.connections.has(key)) {
      const connection = amqp.connect(urls, connectionOptions);
      this.connections.set(key, connection);
    }
    
    return this.connections.get(key)!;
  }

  private createConnectionKey(
    urls: ConnectionUrl[],
    connectionOptions?: AmqpConnectionManagerOptions,
  ): string {
    // Create a deterministic key from URLs and options
    const urlsStr = Array.isArray(urls) ? urls.join(',') : String(urls);
    const optsStr = connectionOptions ? JSON.stringify(connectionOptions) : '';
    return `${urlsStr}::${optsStr}`;
  }

  /**
   * Reset all cached connections (for testing purposes)
   * @internal
   */
  _resetForTesting(): void {
    this.connections.clear();
  }
}

export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  public readonly channel: ChannelWrapper;

  constructor(
    private readonly contract: ContractDefinition,
    options: AmqpClientOptions,
  ) {
    // Always use singleton to get/create connection
    const singleton = ConnectionManagerSingleton.getInstance();
    this.connection = singleton.getConnection(options.urls, options.connectionOptions);
    
    this.channel = this.connection.createChannel({
      json: true,
      setup: (channel: Channel) => this.setup(channel),
    });
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
    // Note: We don't close the connection as it's managed by the singleton
    // and may be shared with other clients
  }

  /**
   * Reset connection singleton cache (for testing only)
   * @internal
   */
  static _resetConnectionCacheForTesting(): void {
    ConnectionManagerSingleton.getInstance()._resetForTesting();
  }

  private async setup(channel: Channel): Promise<void> {
    // Setup exchanges
    const exchangeResults = await Promise.allSettled(
      Object.values(this.contract.exchanges ?? {}).map((exchange) =>
        channel.assertExchange(exchange.name, exchange.type, {
          durable: exchange.durable,
          autoDelete: exchange.autoDelete,
          internal: exchange.internal,
          arguments: exchange.arguments,
        }),
      ),
    );
    const exchangeErrors = exchangeResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (exchangeErrors.length > 0) {
      throw new AggregateError(
        exchangeErrors.map(({ reason }) => reason),
        "Failed to setup exchanges",
      );
    }

    // Setup queues
    const queueResults = await Promise.allSettled(
      Object.values(this.contract.queues ?? {}).map((queue) =>
        channel.assertQueue(queue.name, {
          durable: queue.durable,
          exclusive: queue.exclusive,
          autoDelete: queue.autoDelete,
          arguments: queue.arguments,
        }),
      ),
    );
    const queueErrors = queueResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (queueErrors.length > 0) {
      throw new AggregateError(
        queueErrors.map(({ reason }) => reason),
        "Failed to setup queues",
      );
    }

    // Setup bindings
    const bindingResults = await Promise.allSettled(
      Object.values(this.contract.bindings ?? {}).map((binding) => {
        if (binding.type === "queue") {
          return channel.bindQueue(
            binding.queue.name,
            binding.exchange.name,
            binding.routingKey ?? "",
            binding.arguments,
          );
        }

        return channel.bindExchange(
          binding.destination.name,
          binding.source.name,
          binding.routingKey ?? "",
          binding.arguments,
        );
      }),
    );
    const bindingErrors = bindingResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (bindingErrors.length > 0) {
      throw new AggregateError(
        bindingErrors.map(({ reason }) => reason),
        "Failed to setup bindings",
      );
    }
  }
}
