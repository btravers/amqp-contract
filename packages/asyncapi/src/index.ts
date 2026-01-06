import {
  AsyncAPIObject,
  ChannelObject,
  ChannelsObject,
  MessageObject,
  MessagesObject,
  OperationsObject,
} from "@asyncapi/parser/esm/spec-types/v3";
import { ConditionalSchemaConverter, JSONSchema } from "@orpc/openapi";
import type {
  ContractDefinition,
  ExchangeDefinition,
  MessageDefinition,
  QueueBindingDefinition,
  QueueDefinition,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Options for configuring the AsyncAPI generator.
 *
 * @example
 * ```typescript
 * import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
 * import { zodToJsonSchema } from '@orpc/zod';
 *
 * const generator = new AsyncAPIGenerator({
 *   schemaConverters: [zodToJsonSchema]
 * });
 * ```
 */
export type AsyncAPIGeneratorOptions = {
  /**
   * Schema converters for transforming validation schemas to JSON Schema.
   * Supports Zod, Valibot, ArkType, and other Standard Schema v1 compatible libraries.
   */
  schemaConverters?: ConditionalSchemaConverter[];
};

/**
 * Options for generating an AsyncAPI document.
 * These correspond to the top-level AsyncAPI document fields.
 */
export type AsyncAPIGeneratorGenerateOptions = Pick<AsyncAPIObject, "id" | "info" | "servers">;

/**
 * Generator for creating AsyncAPI 3.0 documentation from AMQP contracts.
 *
 * This class converts contract definitions into AsyncAPI 3.0 specification documents,
 * which can be used for API documentation, code generation, and tooling integration.
 *
 * @example
 * ```typescript
 * import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
 * import { zodToJsonSchema } from '@orpc/zod';
 * import { z } from 'zod';
 *
 * const contract = defineContract({
 *   exchanges: {
 *     orders: defineExchange('orders', 'topic', { durable: true })
 *   },
 *   publishers: {
 *     orderCreated: definePublisher('orders', z.object({
 *       orderId: z.string(),
 *       amount: z.number()
 *     }), {
 *       routingKey: 'order.created'
 *     })
 *   }
 * });
 *
 * const generator = new AsyncAPIGenerator({
 *   schemaConverters: [zodToJsonSchema]
 * });
 *
 * const asyncapi = await generator.generate(contract, {
 *   id: 'urn:com:example:order-service',
 *   info: {
 *     title: 'Order Service API',
 *     version: '1.0.0',
 *     description: 'Async API for order processing'
 *   },
 *   servers: {
 *     production: {
 *       host: 'rabbitmq.example.com',
 *       protocol: 'amqp',
 *       protocolVersion: '0.9.1'
 *     }
 *   }
 * });
 * ```
 */
export class AsyncAPIGenerator {
  private readonly converters: ConditionalSchemaConverter[];

  /**
   * Create a new AsyncAPI generator instance.
   *
   * @param options - Configuration options including schema converters
   */
  constructor(options: AsyncAPIGeneratorOptions = {}) {
    this.converters = options.schemaConverters ?? [];
  }

  /**
   * Generate an AsyncAPI 3.0 document from a contract definition.
   *
   * Converts AMQP exchanges, queues, publishers, and consumers into
   * AsyncAPI channels, operations, and messages with proper JSON Schema
   * validation definitions.
   *
   * @param contract - The AMQP contract definition to convert
   * @param options - AsyncAPI document metadata (id, info, servers)
   * @returns Promise resolving to a complete AsyncAPI 3.0 document
   *
   * @example
   * ```typescript
   * const asyncapi = await generator.generate(contract, {
   *   id: 'urn:com:example:api',
   *   info: {
   *     title: 'My API',
   *     version: '1.0.0'
   *   },
   *   servers: {
   *     dev: {
   *       host: 'localhost:5672',
   *       protocol: 'amqp'
   *     }
   *   }
   * });
   * ```
   */
  async generate(
    contract: ContractDefinition,
    options: AsyncAPIGeneratorGenerateOptions,
  ): Promise<AsyncAPIObject> {
    const convertedChannels: ChannelsObject = {};
    const convertedOperations: OperationsObject = {};
    const convertedMessages: MessagesObject = {};

    // First, collect all messages from publishers and consumers
    const publisherMessages = new Map<string, { message: MessageDefinition; channelKey: string }>();
    const consumerMessages = new Map<string, { message: MessageDefinition; channelKey: string }>();

    // Collect messages from publishers
    if (contract.publishers) {
      for (const [publisherName, publisher] of Object.entries(contract.publishers)) {
        const channelKey = this.getExchangeName(publisher.exchange, contract);
        publisherMessages.set(publisherName, { message: publisher.message, channelKey });
      }
    }

    // Collect messages from consumers
    if (contract.consumers) {
      for (const [consumerName, consumer] of Object.entries(contract.consumers)) {
        const channelKey = this.getQueueName(consumer.queue, contract);
        consumerMessages.set(consumerName, { message: consumer.message, channelKey });
      }
    }

    // Generate channels from queues with their messages
    if (contract.queues) {
      for (const [queueName, queue] of Object.entries(contract.queues)) {
        const channelMessages: MessagesObject = {};

        // Add messages from consumers that reference this queue
        for (const [consumerName, { message, channelKey }] of consumerMessages) {
          if (channelKey === queueName) {
            const messageName = `${consumerName}Message`;
            channelMessages[messageName] = await this.convertMessage(message);
            convertedMessages[messageName] = await this.convertMessage(message);
          }
        }

        // Find bindings for this queue
        const queueBindings = this.getQueueBindings(queue, contract);
        const channel: ChannelObject = {
          ...this.queueToChannel(queue, queueBindings),
        };

        if (Object.keys(channelMessages).length > 0) {
          channel.messages = channelMessages;
        }

        convertedChannels[queueName] = channel;
      }
    }

    // Generate channels from exchanges with their messages
    if (contract.exchanges) {
      for (const [exchangeName, exchange] of Object.entries(contract.exchanges)) {
        const channelMessages: MessagesObject = {};

        // Add messages from publishers that reference this exchange
        for (const [publisherName, { message, channelKey }] of publisherMessages) {
          if (channelKey === exchangeName) {
            const messageName = `${publisherName}Message`;
            channelMessages[messageName] = await this.convertMessage(message);
            convertedMessages[messageName] = await this.convertMessage(message);
          }
        }

        const channel: ChannelObject = {
          ...this.exchangeToChannel(exchange),
        };

        if (Object.keys(channelMessages).length > 0) {
          channel.messages = channelMessages;
        }

        convertedChannels[exchangeName] = channel;
      }
    }

    // Generate publish operations from publishers
    if (contract.publishers) {
      for (const [publisherName, publisher] of Object.entries(contract.publishers)) {
        const exchangeName = this.getExchangeName(publisher.exchange, contract);
        const messageName = `${publisherName}Message`;

        const operation: Record<string, unknown> = {
          action: "send",
          channel: { $ref: `#/channels/${exchangeName}` },
          messages: [{ $ref: `#/channels/${exchangeName}/messages/${messageName}` }],
          summary: `Publish to ${publisher.exchange.name}`,
        };

        // Add operation-level AMQP bindings
        if (publisher.routingKey) {
          operation["bindings"] = {
            amqp: {
              cc: [publisher.routingKey],
              deliveryMode: 2, // Persistent by default
              bindingVersion: "0.3.0",
            },
          };
          operation["description"] = `Routing key: ${publisher.routingKey}`;
        }

        convertedOperations[publisherName] = operation as OperationsObject[string];
      }
    }

    // Generate receive operations from consumers
    if (contract.consumers) {
      for (const [consumerName, consumer] of Object.entries(contract.consumers)) {
        const queueName = this.getQueueName(consumer.queue, contract);
        const messageName = `${consumerName}Message`;

        convertedOperations[consumerName] = {
          action: "receive",
          channel: { $ref: `#/channels/${queueName}` },
          messages: [{ $ref: `#/channels/${queueName}/messages/${messageName}` }],
          summary: `Consume from ${consumer.queue.name}`,
          bindings: {
            amqp: {
              bindingVersion: "0.3.0",
            } as unknown as ChannelObject["bindings"],
          },
        };
      }
    }

    return {
      ...options,
      asyncapi: "3.0.0",
      channels: convertedChannels,
      operations: convertedOperations,
      components: {
        messages: convertedMessages,
      },
    };
  }

  /**
   * Convert a message definition to AsyncAPI MessageObject
   */
  private async convertMessage(message: MessageDefinition): Promise<MessageObject> {
    const payload = message.payload;

    // Convert payload schema
    const payloadJsonSchema = await this.convertSchema(payload, "input");

    // Build result with required properties
    const result: Record<string, unknown> = {
      payload: payloadJsonSchema,
      contentType: "application/json",
    };

    // Add optional properties only if they exist
    if (message.headers) {
      const headersJsonSchema = await this.convertSchema(message.headers, "input");
      if (headersJsonSchema) {
        result["headers"] = headersJsonSchema;
      }
    }

    if (message.summary) {
      result["summary"] = message.summary;
    }

    if (message.description) {
      result["description"] = message.description;
    }

    return result as MessageObject;
  }

  /**
   * Convert a queue definition to AsyncAPI ChannelObject
   */
  private queueToChannel(
    queue: QueueDefinition,
    bindings: QueueBindingDefinition[] = [],
  ): ChannelObject {
    // Build description with binding information
    let description = `AMQP Queue: ${queue.name}`;
    if (bindings.length > 0) {
      const bindingDescriptions = bindings
        .map((binding) => {
          const exchangeName = binding.exchange.name;
          const routingKey = "routingKey" in binding ? binding.routingKey : undefined;
          return routingKey
            ? `bound to exchange '${exchangeName}' with routing key '${routingKey}'`
            : `bound to exchange '${exchangeName}'`;
        })
        .join(", ");
      description += ` (${bindingDescriptions})`;
    }

    const result: Record<string, unknown> = {
      address: queue.name,
      title: queue.name,
      description,
      bindings: {
        amqp: {
          is: "queue",
          queue: {
            name: queue.name,
            durable: queue.durable ?? false,
            exclusive: queue.exclusive ?? false,
            autoDelete: queue.autoDelete ?? false,
            vhost: "/",
          },
          bindingVersion: "0.3.0",
        },
      },
    };

    return result as ChannelObject;
  }

  /**
   * Convert an exchange definition to AsyncAPI ChannelObject
   */
  private exchangeToChannel(exchange: ExchangeDefinition): ChannelObject {
    const result: Record<string, unknown> = {
      address: exchange.name,
      title: exchange.name,
      description: `AMQP Exchange: ${exchange.name} (${exchange.type})`,
      bindings: {
        amqp: {
          is: "routingKey",
          exchange: {
            name: exchange.name,
            type: exchange.type,
            durable: exchange.durable ?? false,
            autoDelete: exchange.autoDelete ?? false,
            vhost: "/",
          },
          bindingVersion: "0.3.0",
        },
      },
    };

    return result as ChannelObject;
  }

  /**
   * Get the name/key of an exchange from the contract
   */
  private getExchangeName(exchange: ExchangeDefinition, contract: ContractDefinition): string {
    if (contract.exchanges) {
      for (const [name, ex] of Object.entries(contract.exchanges)) {
        if (ex === exchange || ex.name === exchange.name) {
          return name;
        }
      }
    }
    return exchange.name;
  }

  /**
   * Get the name/key of a queue from the contract
   */
  private getQueueName(queue: QueueDefinition, contract: ContractDefinition): string {
    if (contract.queues) {
      for (const [name, q] of Object.entries(contract.queues)) {
        if (q === queue || q.name === queue.name) {
          return name;
        }
      }
    }
    return queue.name;
  }

  /**
   * Get all bindings for a queue from the contract
   */
  private getQueueBindings(
    queue: QueueDefinition,
    contract: ContractDefinition,
  ): QueueBindingDefinition[] {
    const result: QueueBindingDefinition[] = [];

    if (contract.bindings) {
      for (const binding of Object.values(contract.bindings)) {
        if (binding.type === "queue" && binding.queue.name === queue.name) {
          result.push(binding);
        }
      }
    }

    return result;
  }

  /**
   * Convert a Standard Schema to JSON Schema using oRPC converters
   */
  private async convertSchema(
    schema: StandardSchemaV1,
    strategy: "input" | "output",
  ): Promise<JSONSchema> {
    // Try each converter until one matches
    for (const converter of this.converters) {
      const matches = await converter.condition(schema, { strategy });
      if (matches) {
        const [_required, jsonSchema] = await converter.convert(schema, { strategy });
        return jsonSchema;
      }
    }

    // If no converter matches, return a generic object schema
    // This allows the contract to still be generated even without schema converters
    return { type: "object" };
  }
}
