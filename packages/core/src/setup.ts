import type {
  ContractDefinition,
  QueueDefinition,
  TtlBackoffRetryOptions,
} from "@amqp-contract/contract";
import type { Channel } from "amqplib";

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

  // Setup wait queues for TTL-backoff retry mode
  const waitQueueSetupTasks: Array<Promise<void>> = [];
  for (const queue of Object.values(contract.queues ?? {})) {
    if (shouldCreateWaitQueue(queue)) {
      const dlx = queue.deadLetter!.exchange;
      const waitQueueName = `${queue.name}-wait`;
      const queueType = queue.type ?? "quorum";
      const durable = queueType === "quorum" ? true : queue.durable;

      waitQueueSetupTasks.push(
        (async () => {
          // Create wait queue with DLX pointing back to the main queue via the original DLX
          // Only set x-queue-type for quorum queues (it's the default, but explicit is better)
          const queueArguments: Record<string, unknown> =
            queueType === "quorum" ? { "x-queue-type": "quorum" } : {};

          await channel.assertQueue(waitQueueName, {
            durable,
            deadLetterExchange: dlx.name,
            deadLetterRoutingKey: queue.name,
            arguments: queueArguments,
          });

          // Bind wait queue to DLX with routing key pattern
          await channel.bindQueue(waitQueueName, dlx.name, `${queue.name}-wait`);

          // Bind main queue to DLX for routing retried messages back
          await channel.bindQueue(queue.name, dlx.name, queue.name);
        })(),
      );
    }
  }

  const waitQueueResults = await Promise.allSettled(waitQueueSetupTasks);
  const waitQueueErrors = waitQueueResults.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (waitQueueErrors.length > 0) {
    throw new AggregateError(
      waitQueueErrors.map(({ reason }) => reason),
      "Failed to setup wait queues",
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

/**
 * Determine if a wait queue should be created for a queue.
 *
 * A wait queue is created when:
 * 1. Queue has DLX configured (required for TTL-backoff retry pattern)
 * 2. Queue uses TTL-backoff retry mode (default if retry is undefined or mode is not "quorum-native")
 */
function shouldCreateWaitQueue(queue: QueueDefinition): boolean {
  // No DLX configured - cannot use TTL-backoff retry
  if (!queue.deadLetter) {
    return false;
  }

  // Check retry mode - default is "ttl-backoff"
  const retryMode = queue.retry?.mode ?? "ttl-backoff";

  // Only create wait queue for TTL-backoff mode
  return retryMode === "ttl-backoff";
}

/**
 * Get the resolved TTL-backoff retry options with defaults.
 *
 * @param queue - The queue definition
 * @returns The resolved retry options, or undefined if the queue doesn't use TTL-backoff retry
 */
export function getResolvedTtlBackoffRetryOptions(
  queue: QueueDefinition,
): (Required<Omit<TtlBackoffRetryOptions, "mode">> & { mode: "ttl-backoff" }) | undefined {
  if (!queue.deadLetter) {
    return undefined;
  }

  const retryMode = queue.retry?.mode ?? "ttl-backoff";
  if (retryMode !== "ttl-backoff") {
    return undefined;
  }

  const retry = queue.retry as TtlBackoffRetryOptions | undefined;

  return {
    mode: "ttl-backoff",
    maxRetries: retry?.maxRetries ?? 3,
    initialDelayMs: retry?.initialDelayMs ?? 1000,
    maxDelayMs: retry?.maxDelayMs ?? 30000,
    backoffMultiplier: retry?.backoffMultiplier ?? 2,
    jitter: retry?.jitter ?? true,
  };
}
