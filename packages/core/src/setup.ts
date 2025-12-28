import type { Channel } from "amqplib";
import type { ContractDefinition } from "@amqp-contract/contract";

/**
 * Setup AMQP topology (exchanges, queues, and bindings) from a contract definition
 */
export async function setupAmqpTopology(
  channel: Channel,
  contract: ContractDefinition,
): Promise<void> {
  // Setup exchanges
  const exchangeResults = await Promise.allSettled(
    Object.values(contract.exchanges ?? {}).map((exchange) =>
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
    Object.values(contract.queues ?? {}).map((queue) => {
      // Build queue arguments, merging dead letter configuration if present
      const queueArguments = { ...queue.arguments };
      if (queue.deadLetter) {
        // Verify that the dead letter exchange exists in the contract
        const dlxName = queue.deadLetter.exchange.name;
        const exchangeExists = Object.values(contract.exchanges ?? {}).some(
          (exchange) => exchange.name === dlxName,
        );

        if (!exchangeExists) {
          throw new Error(
            `Queue "${queue.name}" references dead letter exchange "${dlxName}" which is not declared in the contract. ` +
              `Add the exchange to contract.exchanges to ensure it is created before the queue.`,
          );
        }

        queueArguments["x-dead-letter-exchange"] = dlxName;
        if (queue.deadLetter.routingKey) {
          queueArguments["x-dead-letter-routing-key"] = queue.deadLetter.routingKey;
        }
      }

      return channel.assertQueue(queue.name, {
        durable: queue.durable,
        exclusive: queue.exclusive,
        autoDelete: queue.autoDelete,
        arguments: queueArguments,
      });
    }),
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
    Object.values(contract.bindings ?? {}).map((binding) => {
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
