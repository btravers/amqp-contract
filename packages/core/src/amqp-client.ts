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

export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  public readonly channel: ChannelWrapper;
  private readonly ownsConnection: boolean;

  constructor(
    private readonly contract: ContractDefinition,
    private readonly options: AmqpClientOptions,
  ) {
    this.connection = amqp.connect(this.options.urls, this.options.connectionOptions);
    this.channel = this.connection.createChannel({
      json: true,
      setup: (channel: Channel) => this.setup(channel),
    });
    this.ownsConnection = true;
  }

  /**
   * Create an AmqpClient that shares an existing connection
   *
   * This method allows multiple AmqpClients to share the same underlying AMQP
   * connection while using separate channels. This is useful for reducing resource
   * usage when both publishing and consuming messages in the same application.
   *
   * @param contract - The contract definition specifying exchanges, queues, and bindings
   * @param connection - The existing AmqpConnectionManager to share
   * @returns A new AmqpClient that shares the connection but has its own channel
   *
   * @example
   * ```typescript
   * // Create primary client with its own connection
   * const primaryClient = new AmqpClient(contract, { urls: ['amqp://localhost'] });
   *
   * // Share the connection with a secondary client
   * const sharedConnection = primaryClient.getConnection();
   * const secondaryClient = AmqpClient.fromConnection(contract, sharedConnection);
   *
   * // Both clients share one connection but have separate channels
   * ```
   */
  static fromConnection(
    contract: ContractDefinition,
    connection: AmqpConnectionManager,
  ): AmqpClient {
    const client = Object.create(AmqpClient.prototype);
    client.contract = contract;
    client.connection = connection;
    client.channel = connection.createChannel({
      json: true,
      setup: (channel: Channel) => client.setup(channel),
    });
    client.ownsConnection = false;
    return client;
  }

  /**
   * Get the underlying connection manager
   *
   * This method exposes the AmqpConnectionManager instance that this client uses.
   * The returned connection can be shared with other AmqpClient instances using
   * the `fromConnection()` method to implement connection sharing.
   *
   * @returns The AmqpConnectionManager instance used by this client
   *
   * @example
   * ```typescript
   * const client = new AmqpClient(contract, { urls: ['amqp://localhost'] });
   * const connection = client.getConnection();
   *
   * // Share with another client
   * const anotherClient = AmqpClient.fromConnection(anotherContract, connection);
   * ```
   */
  getConnection(): AmqpConnectionManager {
    return this.connection;
  }

  async close(): Promise<void> {
    await this.channel.close();
    if (this.ownsConnection) {
      await this.connection.close();
    }
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
