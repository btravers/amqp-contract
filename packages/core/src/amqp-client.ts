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
  private refCounts: Map<string, number> = new Map();

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
      this.refCounts.set(key, 0);
    }
    
    // Increment reference count
    this.refCounts.set(key, (this.refCounts.get(key) || 0) + 1);
    
    return this.connections.get(key)!;
  }

  /**
   * Release a connection reference. If no more references exist, close the connection.
   */
  async releaseConnection(
    urls: ConnectionUrl[],
    connectionOptions?: AmqpConnectionManagerOptions,
  ): Promise<void> {
    const key = this.createConnectionKey(urls, connectionOptions);
    const refCount = this.refCounts.get(key) || 0;
    
    if (refCount <= 1) {
      // Last reference - close and remove connection
      const connection = this.connections.get(key);
      if (connection) {
        await connection.close();
        this.connections.delete(key);
        this.refCounts.delete(key);
      }
    } else {
      // Decrement reference count
      this.refCounts.set(key, refCount - 1);
    }
  }

  private createConnectionKey(
    urls: ConnectionUrl[],
    connectionOptions?: AmqpConnectionManagerOptions,
  ): string {
    // Create a deterministic key from URLs and options
    // Use JSON.stringify for URLs to avoid ambiguity (e.g., ['a,b'] vs ['a', 'b'])
    const urlsStr = JSON.stringify(urls);
    // Sort object keys for deterministic serialization of connection options
    const optsStr = connectionOptions ? this.serializeOptions(connectionOptions) : '';
    return `${urlsStr}::${optsStr}`;
  }

  private serializeOptions(options: AmqpConnectionManagerOptions): string {
    // Create a deterministic string representation by sorting keys
    const sorted = Object.keys(options)
      .sort()
      .reduce((acc, key) => {
        acc[key] = options[key as keyof AmqpConnectionManagerOptions];
        return acc;
      }, {} as Record<string, unknown>);
    return JSON.stringify(sorted);
  }

  /**
   * Reset all cached connections (for testing purposes)
   * @internal
   */
  async _resetForTesting(): Promise<void> {
    // Close all connections before clearing
    const closePromises = Array.from(this.connections.values()).map(conn => conn.close());
    await Promise.all(closePromises);
    this.connections.clear();
    this.refCounts.clear();
  }
}

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
    this.connectionOptions = options.connectionOptions;
    
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
