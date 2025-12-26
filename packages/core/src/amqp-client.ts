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
  connection?: never;
} | {
  connection: AmqpConnectionManager;
  urls?: never;
  connectionOptions?: never;
};

export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  public readonly channel: ChannelWrapper;
  private readonly ownsConnection: boolean;

  constructor(
    private readonly contract: ContractDefinition,
    options: AmqpClientOptions,
  ) {
    if ('connection' in options && options.connection) {
      this.connection = options.connection;
      this.ownsConnection = false;
    } else {
      this.connection = amqp.connect(options.urls, options.connectionOptions);
      this.ownsConnection = true;
    }
    this.channel = this.connection.createChannel({
      json: true,
      setup: (channel: Channel) => this.setup(channel),
    });
  }

  /**
   * Get the underlying connection manager
   *
   * This method exposes the AmqpConnectionManager instance that this client uses.
   * The returned connection can be shared with other AmqpClient instances to
   * implement connection sharing while each client maintains its own channel.
   *
   * @returns The AmqpConnectionManager instance used by this client
   *
   * @example
   * ```typescript
   * const primaryClient = new AmqpClient(contract, { urls: ['amqp://localhost'] });
   * const connection = primaryClient.getConnection();
   *
   * // Share the connection with another AmqpClient
   * const secondaryClient = new AmqpClient(anotherContract, { connection });
   * // Both clients share one connection but have separate channels
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
