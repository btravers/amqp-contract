import amqp, {
  AmqpConnectionManager,
  AmqpConnectionManagerOptions,
  ConnectionUrl,
} from "amqp-connection-manager";

/**
 * Connection manager singleton for sharing connections across clients
 */
export class ConnectionManagerSingleton {
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
    this.refCounts.set(key, (this.refCounts.get(key) ?? 0) + 1);

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
    const refCount = this.refCounts.get(key) ?? 0;

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
    const optsStr = connectionOptions ? this.serializeOptions(connectionOptions) : "";
    return `${urlsStr}::${optsStr}`;
  }

  private serializeOptions(options: AmqpConnectionManagerOptions): string {
    // Create a deterministic string representation by deeply sorting all object keys
    const sorted = this.deepSort(options);
    return JSON.stringify(sorted);
  }

  private deepSort(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.deepSort(item));
    }

    if (value !== null && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const sortedKeys = Object.keys(obj).sort();
      const result: Record<string, unknown> = {};

      for (const key of sortedKeys) {
        result[key] = this.deepSort(obj[key]);
      }

      return result;
    }

    return value;
  }

  /**
   * Reset all cached connections (for testing purposes)
   * @internal
   */
  async _resetForTesting(): Promise<void> {
    // Close all connections before clearing
    const closePromises = Array.from(this.connections.values()).map((conn) => conn.close());
    await Promise.all(closePromises);
    this.connections.clear();
    this.refCounts.clear();
  }
}
