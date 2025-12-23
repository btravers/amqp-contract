import { ConditionalSchemaConverter, JSONSchema } from "@orpc/openapi";
import {
  AsyncAPIObject,
  ChannelsObject,
  OperationsObject,
  MessagesObject,
  MessageObject,
  ChannelObject,
} from "@asyncapi/parser/esm/spec-types/v3";
import type {
  ContractDefinition,
  MessageDefinition,
  QueueDefinition,
  ExchangeDefinition,
} from "@amqp-contract/contract";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface AsyncAPIGeneratorOptions {
  schemaConverters?: ConditionalSchemaConverter[];
}

export type AsyncAPIGeneratorGenerateOptions = Pick<AsyncAPIObject, "id" | "info" | "servers">;

export class AsyncAPIGenerator {
  private readonly converters: ConditionalSchemaConverter[];

  constructor(options: AsyncAPIGeneratorOptions = {}) {
    this.converters = options.schemaConverters ?? [];
  }

  /**
   * Generate an AsyncAPI 3.0 document from a contract definition
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

        const channel: ChannelObject = {
          ...this.queueToChannel(queue),
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

        convertedOperations[publisherName] = {
          action: "send",
          channel: { $ref: `#/channels/${exchangeName}` },
          messages: [{ $ref: `#/channels/${exchangeName}/messages/${messageName}` }],
          summary: `Publish to ${publisher.exchange.name}`,
          ...(publisher.routingKey && {
            description: `Routing key: ${publisher.routingKey}`,
          }),
        };
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
          ...(consumer.prefetch && {
            description: `Prefetch: ${consumer.prefetch}`,
          }),
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
  private queueToChannel(queue: QueueDefinition): ChannelObject {
    const result: Record<string, unknown> = {
      address: queue.name,
      title: queue.name,
      description: `AMQP Queue: ${queue.name}`,
      bindings: {
        amqp: {
          is: "queue",
          queue: {
            name: queue.name,
            durable: queue.durable ?? false,
            exclusive: queue.exclusive ?? false,
            autoDelete: queue.autoDelete ?? false,
            ...(queue.arguments && { vhost: "/" }),
          },
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
            ...(exchange.arguments && { vhost: "/" }),
          },
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
