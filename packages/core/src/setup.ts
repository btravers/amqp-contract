import type { Channel } from "amqplib";
import type { ContractDefinition } from "@amqp-contract/contract";

/**
 * Setup AMQP resources (exchanges, queues, bindings) for a contract
 * This function is used by both client and worker to establish the AMQP topology
 *
 * @param channel - AMQP channel to use for setup
 * @param contract - Contract definition containing exchanges, queues, and bindings
 */
export async function setupInfra(channel: Channel, contract: ContractDefinition): Promise<void> {
  // Setup exchanges
  if (contract.exchanges) {
    await Promise.all(
      Object.values(contract.exchanges).map((exchange) =>
        channel.assertExchange(exchange.name, exchange.type, {
          durable: exchange.durable,
          autoDelete: exchange.autoDelete,
          internal: exchange.internal,
          arguments: exchange.arguments,
        }),
      ),
    );
  }

  // Setup queues
  if (contract.queues) {
    await Promise.all(
      Object.values(contract.queues).map((queue) =>
        channel.assertQueue(queue.name, {
          durable: queue.durable,
          exclusive: queue.exclusive,
          autoDelete: queue.autoDelete,
          arguments: queue.arguments,
        }),
      ),
    );
  }

  // Setup bindings
  if (contract.bindings) {
    await Promise.all(
      Object.values(contract.bindings).map((binding) => {
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
  }
}
