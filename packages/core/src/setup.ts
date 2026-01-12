import type { Channel } from "amqplib";
import type { ContractDefinition } from "@amqp-contract/contract";

/**
 * Setup AMQP topology (exchanges, queues, and bindings) from a contract definition.
 *
 * This function sets up the complete AMQP topology in the correct order:
 * 1. Assert all exchanges defined in the contract
 * 2. Validate dead letter exchanges are declared before referencing them
 * 3. Assert all queues with their configurations (including dead letter settings)
 * 4. Create all bindings (queue-to-exchange and exchange-to-exchange)
 *
 * @param channel - The AMQP channel to use for topology setup
 * @param contract - The contract definition containing the topology specification
 * @throws {AggregateError} If any exchanges, queues, or bindings fail to be created
 * @throws {Error} If a queue references a dead letter exchange not declared in the contract
 *
 * @example
 * ```typescript
 * const channel = await connection.createChannel();
 * await setupAmqpTopology(channel, contract);
 * ```
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

  // Validate dead letter exchanges before setting up queues
  for (const queue of Object.values(contract.queues ?? {})) {
    if (queue.deadLetter) {
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
    }
  }

  // Setup queues
  const queueResults = await Promise.allSettled(
    Object.values(contract.queues ?? {}).map((queue) => {
      // Build queue arguments, merging dead letter configuration and queue type
      const queueArguments = { ...queue.arguments };

      // Set queue type - use the defined type or default to 'quorum'
      const queueType = queue.type ?? "quorum";
      queueArguments["x-queue-type"] = queueType;

      if (queue.deadLetter) {
        queueArguments["x-dead-letter-exchange"] = queue.deadLetter.exchange.name;
        if (queue.deadLetter.routingKey) {
          queueArguments["x-dead-letter-routing-key"] = queue.deadLetter.routingKey;
        }
      }

      // Set delivery limit for quorum queues (native retry support)
      if (queueType === "quorum" && queue.deliveryLimit !== undefined) {
        queueArguments["x-delivery-limit"] = queue.deliveryLimit;
      }

      // For quorum queues, force durable to true as they are always durable
      const durable = queueType === "quorum" ? true : queue.durable;

      return channel.assertQueue(queue.name, {
        durable,
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
