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
    for (const exchange of Object.values(contract.exchanges)) {
      await channel.assertExchange(exchange.name, exchange.type, {
        durable: exchange.durable,
        autoDelete: exchange.autoDelete,
        internal: exchange.internal,
        arguments: exchange.arguments,
      });
    }
  }

  // Setup queues
  if (contract.queues) {
    for (const queue of Object.values(contract.queues)) {
      await channel.assertQueue(queue.name, {
        durable: queue.durable,
        exclusive: queue.exclusive,
        autoDelete: queue.autoDelete,
        arguments: queue.arguments,
      });
    }
  }

  // Setup bindings
  if (contract.bindings) {
    for (const binding of Object.values(contract.bindings)) {
      if (binding.type === "queue") {
        await channel.bindQueue(
          binding.queue.name,
          binding.exchange.name,
          binding.routingKey ?? "",
          binding.arguments,
        );
      } else if (binding.type === "exchange") {
        await channel.bindExchange(
          binding.destination.name,
          binding.source.name,
          binding.routingKey ?? "",
          binding.arguments,
        );
      }
    }
  }
}
