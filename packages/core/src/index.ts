import type { Channel } from "amqplib";
import type { ContractDefinition } from "@amqp-contract/contract";
import amqp, {
  AmqpConnectionManager,
  AmqpConnectionManagerOptions,
  ChannelWrapper,
  ConnectionUrl,
} from "amqp-connection-manager";

export type AmqpClientOptions = {
  urls: ConnectionUrl[];
  connectionOptions?: AmqpConnectionManagerOptions;
};

export class AmqpClient {
  private readonly connection: AmqpConnectionManager;
  public readonly channel: ChannelWrapper;

  constructor(
    private readonly contract: ContractDefinition,
    private readonly options: AmqpClientOptions,
  ) {
    this.connection = amqp.connect(this.options.urls, this.options.connectionOptions);
    this.channel = this.connection.createChannel({
      json: true,
      setup: (channel: Channel) => this.setup(channel),
    });
  }

  async close(): Promise<void> {
    await this.connection.close();
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
