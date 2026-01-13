import type {
  BindingDefinition,
  ConsumerDefinition,
  ContractDefinition,
  PublisherDefinition,
} from "./types.js";

// =============================================================================
// Validation Error Types
// =============================================================================

/**
 * Base class for contract validation errors.
 * Provides structured error information for programmatic handling.
 */
export class ContractValidationError extends Error {
  /**
   * Error code for programmatic handling
   */
  readonly code: string;

  /**
   * Additional context about the error
   */
  readonly context: Record<string, unknown> | undefined;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "ContractValidationError";
    this.code = code;
    this.context = context;
  }
}

/**
 * Error codes for contract validation failures
 */
export const ValidationErrorCode = {
  // Queue validation
  INVALID_MAX_PRIORITY: "INVALID_MAX_PRIORITY",
  INVALID_DELIVERY_LIMIT: "INVALID_DELIVERY_LIMIT",
  INVALID_QUEUE_NAME: "INVALID_QUEUE_NAME",

  // Exchange validation
  INVALID_EXCHANGE_NAME: "INVALID_EXCHANGE_NAME",
  INVALID_EXCHANGE_TYPE: "INVALID_EXCHANGE_TYPE",

  // Routing key validation
  INVALID_ROUTING_KEY: "INVALID_ROUTING_KEY",
  ROUTING_KEY_CONTAINS_WILDCARDS: "ROUTING_KEY_CONTAINS_WILDCARDS",
  EMPTY_ROUTING_KEY: "EMPTY_ROUTING_KEY",

  // Contract validation
  CONSUMER_NOT_FOUND: "CONSUMER_NOT_FOUND",
  PUBLISHER_NOT_FOUND: "PUBLISHER_NOT_FOUND",
  BINDING_REFERENCES_UNDEFINED_EXCHANGE: "BINDING_REFERENCES_UNDEFINED_EXCHANGE",
  BINDING_REFERENCES_UNDEFINED_QUEUE: "BINDING_REFERENCES_UNDEFINED_QUEUE",
  PUBLISHER_REFERENCES_UNDEFINED_EXCHANGE: "PUBLISHER_REFERENCES_UNDEFINED_EXCHANGE",
  CONSUMER_REFERENCES_UNDEFINED_QUEUE: "CONSUMER_REFERENCES_UNDEFINED_QUEUE",
} as const;

export type ValidationErrorCode = (typeof ValidationErrorCode)[keyof typeof ValidationErrorCode];

// =============================================================================
// Queue Validation
// =============================================================================

/**
 * Validation constraints for queue options
 */
export const QueueConstraints = {
  MAX_PRIORITY: {
    MIN: 1,
    MAX: 255,
    RECOMMENDED_MAX: 10,
  },
  DELIVERY_LIMIT: {
    MIN: 1,
  },
} as const;

/**
 * Validate maxPriority value for classic queues.
 *
 * @param maxPriority - The maxPriority value to validate
 * @throws {ContractValidationError} if maxPriority is invalid
 */
export function validateMaxPriority(maxPriority: number): void {
  if (!Number.isInteger(maxPriority)) {
    throw new ContractValidationError(
      `Invalid maxPriority: ${maxPriority}. Must be an integer.`,
      ValidationErrorCode.INVALID_MAX_PRIORITY,
      { value: maxPriority, expected: "integer" },
    );
  }

  if (maxPriority < QueueConstraints.MAX_PRIORITY.MIN) {
    throw new ContractValidationError(
      `Invalid maxPriority: ${maxPriority}. Must be at least ${QueueConstraints.MAX_PRIORITY.MIN}.`,
      ValidationErrorCode.INVALID_MAX_PRIORITY,
      {
        value: maxPriority,
        min: QueueConstraints.MAX_PRIORITY.MIN,
        max: QueueConstraints.MAX_PRIORITY.MAX,
      },
    );
  }

  if (maxPriority > QueueConstraints.MAX_PRIORITY.MAX) {
    throw new ContractValidationError(
      `Invalid maxPriority: ${maxPriority}. Must be at most ${QueueConstraints.MAX_PRIORITY.MAX}. ` +
        `Recommended range: ${QueueConstraints.MAX_PRIORITY.MIN}-${QueueConstraints.MAX_PRIORITY.RECOMMENDED_MAX}.`,
      ValidationErrorCode.INVALID_MAX_PRIORITY,
      {
        value: maxPriority,
        min: QueueConstraints.MAX_PRIORITY.MIN,
        max: QueueConstraints.MAX_PRIORITY.MAX,
        recommendedMax: QueueConstraints.MAX_PRIORITY.RECOMMENDED_MAX,
      },
    );
  }
}

/**
 * Validate deliveryLimit value for quorum queues.
 *
 * @param deliveryLimit - The deliveryLimit value to validate
 * @throws {ContractValidationError} if deliveryLimit is invalid
 */
export function validateDeliveryLimit(deliveryLimit: number): void {
  if (!Number.isInteger(deliveryLimit)) {
    throw new ContractValidationError(
      `Invalid deliveryLimit: ${deliveryLimit}. Must be a positive integer.`,
      ValidationErrorCode.INVALID_DELIVERY_LIMIT,
      { value: deliveryLimit, expected: "positive integer" },
    );
  }

  if (deliveryLimit < QueueConstraints.DELIVERY_LIMIT.MIN) {
    throw new ContractValidationError(
      `Invalid deliveryLimit: ${deliveryLimit}. Must be at least ${QueueConstraints.DELIVERY_LIMIT.MIN}.`,
      ValidationErrorCode.INVALID_DELIVERY_LIMIT,
      { value: deliveryLimit, min: QueueConstraints.DELIVERY_LIMIT.MIN },
    );
  }
}

/**
 * Validate queue name.
 *
 * @param name - The queue name to validate
 * @throws {ContractValidationError} if name is invalid
 */
export function validateQueueName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ContractValidationError(
      "Invalid queue name: cannot be empty.",
      ValidationErrorCode.INVALID_QUEUE_NAME,
      { value: name },
    );
  }
}

// =============================================================================
// Exchange Validation
// =============================================================================

const VALID_EXCHANGE_TYPES = ["fanout", "direct", "topic"] as const;

/**
 * Validate exchange name.
 *
 * @param name - The exchange name to validate
 * @throws {ContractValidationError} if name is invalid
 */
export function validateExchangeName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ContractValidationError(
      "Invalid exchange name: cannot be empty.",
      ValidationErrorCode.INVALID_EXCHANGE_NAME,
      { value: name },
    );
  }
}

/**
 * Validate exchange type.
 *
 * @param type - The exchange type to validate
 * @throws {ContractValidationError} if type is invalid
 */
export function validateExchangeType(type: string): void {
  if (!VALID_EXCHANGE_TYPES.includes(type as (typeof VALID_EXCHANGE_TYPES)[number])) {
    throw new ContractValidationError(
      `Invalid exchange type: "${type}". Must be one of: ${VALID_EXCHANGE_TYPES.join(", ")}.`,
      ValidationErrorCode.INVALID_EXCHANGE_TYPE,
      { value: type, validTypes: VALID_EXCHANGE_TYPES },
    );
  }
}

// =============================================================================
// Routing Key Validation
// =============================================================================

/**
 * Validate that a routing key does not contain wildcards.
 * Routing keys used for publishing should not contain * or #.
 *
 * @param routingKey - The routing key to validate
 * @throws {ContractValidationError} if routing key contains wildcards
 */
export function validateRoutingKey(routingKey: string): void {
  if (!routingKey || routingKey.trim().length === 0) {
    throw new ContractValidationError(
      "Invalid routing key: cannot be empty.",
      ValidationErrorCode.EMPTY_ROUTING_KEY,
      { value: routingKey },
    );
  }

  if (routingKey.includes("*") || routingKey.includes("#")) {
    throw new ContractValidationError(
      `Invalid routing key: "${routingKey}". Routing keys for publishing cannot contain wildcards (* or #).`,
      ValidationErrorCode.ROUTING_KEY_CONTAINS_WILDCARDS,
      { value: routingKey },
    );
  }
}

// =============================================================================
// Contract Validation
// =============================================================================

/**
 * Result of contract validation containing all found issues.
 */
export type ContractValidationResult = {
  valid: boolean;
  errors: ContractValidationError[];
};

/**
 * Get all exchange names from a contract (both exchange keys and exchange definition names).
 */
function getExchangeNames(contract: ContractDefinition): Set<string> {
  const names = new Set<string>();
  if (contract.exchanges) {
    for (const exchange of Object.values(contract.exchanges)) {
      names.add(exchange.name);
    }
  }
  return names;
}

/**
 * Get all queue names from a contract (both queue keys and queue definition names).
 */
function getQueueNames(contract: ContractDefinition): Set<string> {
  const names = new Set<string>();
  if (contract.queues) {
    for (const queue of Object.values(contract.queues)) {
      names.add(queue.name);
    }
  }
  return names;
}

/**
 * Validate that a binding references defined exchanges and queues.
 */
function validateBinding(
  bindingKey: string,
  binding: BindingDefinition,
  exchangeNames: Set<string>,
  queueNames: Set<string>,
): ContractValidationError[] {
  const errors: ContractValidationError[] = [];

  if (binding.type === "queue") {
    // Validate queue reference
    if (!queueNames.has(binding.queue.name)) {
      errors.push(
        new ContractValidationError(
          `Binding "${bindingKey}" references undefined queue "${binding.queue.name}".`,
          ValidationErrorCode.BINDING_REFERENCES_UNDEFINED_QUEUE,
          { bindingKey, queueName: binding.queue.name, availableQueues: [...queueNames] },
        ),
      );
    }

    // Validate exchange reference
    if (!exchangeNames.has(binding.exchange.name)) {
      errors.push(
        new ContractValidationError(
          `Binding "${bindingKey}" references undefined exchange "${binding.exchange.name}".`,
          ValidationErrorCode.BINDING_REFERENCES_UNDEFINED_EXCHANGE,
          {
            bindingKey,
            exchangeName: binding.exchange.name,
            availableExchanges: [...exchangeNames],
          },
        ),
      );
    }
  } else if (binding.type === "exchange") {
    // Exchange-to-exchange binding
    if (!exchangeNames.has(binding.source.name)) {
      errors.push(
        new ContractValidationError(
          `Binding "${bindingKey}" references undefined source exchange "${binding.source.name}".`,
          ValidationErrorCode.BINDING_REFERENCES_UNDEFINED_EXCHANGE,
          {
            bindingKey,
            exchangeName: binding.source.name,
            availableExchanges: [...exchangeNames],
          },
        ),
      );
    }

    if (!exchangeNames.has(binding.destination.name)) {
      errors.push(
        new ContractValidationError(
          `Binding "${bindingKey}" references undefined destination exchange "${binding.destination.name}".`,
          ValidationErrorCode.BINDING_REFERENCES_UNDEFINED_EXCHANGE,
          {
            bindingKey,
            exchangeName: binding.destination.name,
            availableExchanges: [...exchangeNames],
          },
        ),
      );
    }
  }

  return errors;
}

/**
 * Validate that a publisher references a defined exchange.
 */
function validatePublisher(
  publisherKey: string,
  publisher: PublisherDefinition,
  exchangeNames: Set<string>,
): ContractValidationError[] {
  const errors: ContractValidationError[] = [];

  if (!exchangeNames.has(publisher.exchange.name)) {
    errors.push(
      new ContractValidationError(
        `Publisher "${publisherKey}" references undefined exchange "${publisher.exchange.name}".`,
        ValidationErrorCode.PUBLISHER_REFERENCES_UNDEFINED_EXCHANGE,
        {
          publisherKey,
          exchangeName: publisher.exchange.name,
          availableExchanges: [...exchangeNames],
        },
      ),
    );
  }

  return errors;
}

/**
 * Validate that a consumer references a defined queue.
 */
function validateConsumer(
  consumerKey: string,
  consumer: ConsumerDefinition,
  queueNames: Set<string>,
): ContractValidationError[] {
  const errors: ContractValidationError[] = [];

  if (!queueNames.has(consumer.queue.name)) {
    errors.push(
      new ContractValidationError(
        `Consumer "${consumerKey}" references undefined queue "${consumer.queue.name}".`,
        ValidationErrorCode.CONSUMER_REFERENCES_UNDEFINED_QUEUE,
        { consumerKey, queueName: consumer.queue.name, availableQueues: [...queueNames] },
      ),
    );
  }

  return errors;
}

/**
 * Validate a complete contract definition for referential integrity.
 *
 * Checks that:
 * - All bindings reference defined exchanges and queues
 * - All publishers reference defined exchanges
 * - All consumers reference defined queues
 *
 * @param contract - The contract definition to validate
 * @returns Validation result with all found errors
 *
 * @example
 * ```typescript
 * const result = validateContract(myContract);
 * if (!result.valid) {
 *   for (const error of result.errors) {
 *     console.error(`${error.code}: ${error.message}`);
 *   }
 * }
 * ```
 */
export function validateContract(contract: ContractDefinition): ContractValidationResult {
  const errors: ContractValidationError[] = [];
  const exchangeNames = getExchangeNames(contract);
  const queueNames = getQueueNames(contract);

  // Validate bindings
  if (contract.bindings) {
    for (const [key, binding] of Object.entries(contract.bindings)) {
      errors.push(...validateBinding(key, binding, exchangeNames, queueNames));
    }
  }

  // Validate publishers
  if (contract.publishers) {
    for (const [key, publisher] of Object.entries(contract.publishers)) {
      errors.push(...validatePublisher(key, publisher, exchangeNames));
    }
  }

  // Validate consumers
  if (contract.consumers) {
    for (const [key, consumer] of Object.entries(contract.consumers)) {
      errors.push(...validateConsumer(key, consumer, queueNames));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a contract and throw if invalid.
 *
 * @param contract - The contract definition to validate
 * @throws {ContractValidationError} if contract is invalid (throws first error)
 *
 * @example
 * ```typescript
 * try {
 *   assertValidContract(myContract);
 * } catch (error) {
 *   if (error instanceof ContractValidationError) {
 *     console.error(`Validation failed: ${error.code} - ${error.message}`);
 *   }
 * }
 * ```
 */
export function assertValidContract(contract: ContractDefinition): void {
  const result = validateContract(contract);
  if (!result.valid && result.errors.length > 0) {
    throw result.errors[0];
  }
}

// =============================================================================
// Consumer Validation Utilities (for worker package)
// =============================================================================

/**
 * Check if a consumer exists in the contract.
 *
 * @param contract - The contract definition
 * @param consumerName - The consumer name to check
 * @returns true if the consumer exists
 */
export function hasConsumer(contract: ContractDefinition, consumerName: string): boolean {
  return contract.consumers !== undefined && consumerName in contract.consumers;
}

/**
 * Get available consumer names from a contract.
 *
 * @param contract - The contract definition
 * @returns Array of consumer names
 */
export function getConsumerNames(contract: ContractDefinition): string[] {
  return contract.consumers ? Object.keys(contract.consumers) : [];
}

/**
 * Validate that a consumer exists in the contract.
 *
 * @param contract - The contract definition
 * @param consumerName - The consumer name to validate
 * @throws {ContractValidationError} if the consumer is not found
 */
export function assertConsumerExists(contract: ContractDefinition, consumerName: string): void {
  if (!hasConsumer(contract, consumerName)) {
    const available = getConsumerNames(contract);
    throw new ContractValidationError(
      `Consumer "${consumerName}" not found in contract. Available consumers: ${available.length > 0 ? available.join(", ") : "none"}`,
      ValidationErrorCode.CONSUMER_NOT_FOUND,
      { consumerName, availableConsumers: available },
    );
  }
}

/**
 * Validate that all handler names correspond to consumers in the contract.
 *
 * @param contract - The contract definition
 * @param handlerNames - Array of handler names to validate
 * @throws {ContractValidationError} if any handler references a non-existent consumer
 */
export function assertHandlersMatchConsumers(
  contract: ContractDefinition,
  handlerNames: string[],
): void {
  const available = getConsumerNames(contract);

  for (const handlerName of handlerNames) {
    if (!hasConsumer(contract, handlerName)) {
      throw new ContractValidationError(
        `Handler "${handlerName}" references non-existent consumer. Available consumers: ${available.length > 0 ? available.join(", ") : "none"}`,
        ValidationErrorCode.CONSUMER_NOT_FOUND,
        { handlerName, availableConsumers: available },
      );
    }
  }
}
