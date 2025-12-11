import type { ContractDefinition } from "@amqp-contract/contract";
import { match } from "ts-pattern";

/**
 * AsyncAPI 3.0.0 Specification
 */
export interface AsyncAPIDocument {
  asyncapi: "3.0.0";
  info: AsyncAPIInfo;
  servers?: Record<string, AsyncAPIServer>;
  channels?: Record<string, AsyncAPIChannel>;
  operations?: Record<string, AsyncAPIOperation>;
  components?: AsyncAPIComponents;
}

export interface AsyncAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface AsyncAPIServer {
  host: string;
  protocol: string;
  description?: string;
  variables?: Record<string, { default: string; description?: string }>;
}

export interface AsyncAPIChannel {
  address: string;
  messages?: Record<string, AsyncAPIMessageRef>;
  description?: string;
  bindings?: {
    amqp?: {
      is: "queue" | "routingKey";
      queue?: {
        name: string;
        durable?: boolean;
        exclusive?: boolean;
        autoDelete?: boolean;
      };
      exchange?: {
        name: string;
        type: "topic" | "direct" | "fanout" | "headers";
        durable?: boolean;
        autoDelete?: boolean;
      };
    };
  };
}

export interface AsyncAPIOperation {
  action: "send" | "receive";
  channel: AsyncAPIRef;
  messages?: AsyncAPIMessageRef[];
  description?: string;
}

export interface AsyncAPIMessageRef {
  $ref?: string;
  payload?: AsyncAPISchema;
  contentType?: string;
  name?: string;
  title?: string;
  summary?: string;
  description?: string;
}

export interface AsyncAPISchema {
  type?: string;
  properties?: Record<string, AsyncAPISchema>;
  required?: string[];
  items?: AsyncAPISchema;
  $ref?: string;
  description?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
}

export interface AsyncAPIRef {
  $ref: string;
}

export interface AsyncAPIComponents {
  messages?: Record<string, AsyncAPIMessageRef>;
  schemas?: Record<string, AsyncAPISchema>;
}

/**
 * Options for generating AsyncAPI specification
 */
export interface GenerateAsyncAPIOptions {
  info: Omit<AsyncAPIInfo, "title" | "version"> & {
    title?: string;
    version?: string;
  };
  servers?: Record<string, AsyncAPIServer>;
}

/**
 * Convert a Zod schema to AsyncAPI schema
 */
function zodSchemaToAsyncAPI(schema: unknown): AsyncAPISchema {
  // Handle Zod 4.x structure
  if (typeof schema !== "object" || schema === null || !("def" in schema && "type" in schema)) {
    return { type: "object" };
  }

  const zodSchema = schema as {
    type: string;
    def: { type: string; shape?: Record<string, unknown> };
    shape?: Record<string, unknown>;
  };

  const schemaType = zodSchema.type || zodSchema.def?.type;

  return match(schemaType)
    .with("object", () => {
      // Try to get shape from both locations
      const shape =
        zodSchema.shape || (zodSchema.def as { shape?: Record<string, unknown> })?.shape;
      if (!shape) {
        return { type: "object" as const };
      }

      const properties: Record<string, AsyncAPISchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodSchemaToAsyncAPI(value);

        // Check if optional - Zod 4.x uses different structure
        if (value && typeof value === "object" && "type" in value) {
          const valueType = (value as { type: string }).type;
          if (valueType !== "optional") {
            required.push(key);
          }
        } else {
          required.push(key);
        }
      }

      const result: AsyncAPISchema = {
        type: "object",
        properties,
      };

      if (required.length > 0) {
        result.required = required;
      }

      return result;
    })
    .with("string", () => ({ type: "string" as const }))
    .with("number", () => ({ type: "number" as const }))
    .with("boolean", () => ({ type: "boolean" as const }))
    .with("array", () => {
      // In Zod 4.x, array element is in def
      const def = zodSchema.def as { element?: unknown };
      const element = def?.element;
      return {
        type: "array" as const,
        items: element ? zodSchemaToAsyncAPI(element) : { type: "object" as const },
      };
    })
    .otherwise(() => ({ type: "object" as const }));
}

/**
 * Generate AsyncAPI 3.0.0 specification from AMQP contract
 */
export function generateAsyncAPI(
  contract: ContractDefinition,
  options: GenerateAsyncAPIOptions,
): AsyncAPIDocument {
  const channels: Record<string, AsyncAPIChannel> = {};
  const operations: Record<string, AsyncAPIOperation> = {};
  const messages: Record<string, AsyncAPIMessageRef> = {};

  // Generate channels from queues
  if (contract.queues) {
    for (const [queueName, queue] of Object.entries(contract.queues)) {
      const binding: {
        amqp?: {
          is: "queue";
          queue?: {
            name: string;
            durable?: boolean;
            exclusive?: boolean;
            autoDelete?: boolean;
          };
        };
      } = {
        amqp: {
          is: "queue",
          queue: {
            name: queue.name,
          },
        },
      };

      if (queue.durable !== undefined) {
        binding.amqp!.queue!.durable = queue.durable;
      }
      if (queue.exclusive !== undefined) {
        binding.amqp!.queue!.exclusive = queue.exclusive;
      }
      if (queue.autoDelete !== undefined) {
        binding.amqp!.queue!.autoDelete = queue.autoDelete;
      }

      channels[queueName] = {
        address: queue.name,
        description: `Queue: ${queue.name}`,
        bindings: binding,
      };
    }
  }

  // Generate channels from exchanges
  if (contract.exchanges) {
    for (const [exchangeName, exchange] of Object.entries(contract.exchanges)) {
      const binding: {
        amqp?: {
          is: "routingKey";
          exchange?: {
            name: string;
            type: "topic" | "direct" | "fanout" | "headers";
            durable?: boolean;
            autoDelete?: boolean;
          };
        };
      } = {
        amqp: {
          is: "routingKey",
          exchange: {
            name: exchange.name,
            type: exchange.type,
          },
        },
      };

      if (exchange.durable !== undefined) {
        binding.amqp!.exchange!.durable = exchange.durable;
      }
      if (exchange.autoDelete !== undefined) {
        binding.amqp!.exchange!.autoDelete = exchange.autoDelete;
      }

      channels[exchangeName] = {
        address: exchange.name,
        description: `Exchange: ${exchange.name} (${exchange.type})`,
        bindings: binding,
      };
    }
  }

  // Generate operations from publishers
  if (contract.publishers) {
    for (const [publisherName, publisher] of Object.entries(contract.publishers)) {
      const messageName = `${publisherName}Message`;

      messages[messageName] = {
        name: messageName,
        title: `${publisherName} message`,
        contentType: "application/json",
        payload: zodSchemaToAsyncAPI(publisher.message),
      };

      operations[publisherName] = {
        action: "send",
        channel: { $ref: `#/channels/${publisher.exchange}` },
        messages: [{ $ref: `#/components/messages/${messageName}` }],
        description: `Publish message to ${publisher.exchange}`,
      };
    }
  }

  // Generate operations from consumers
  if (contract.consumers) {
    for (const [consumerName, consumer] of Object.entries(contract.consumers)) {
      const messageName = `${consumerName}Message`;

      messages[messageName] = {
        name: messageName,
        title: `${consumerName} message`,
        contentType: "application/json",
        payload: zodSchemaToAsyncAPI(consumer.message),
      };

      operations[consumerName] = {
        action: "receive",
        channel: { $ref: `#/channels/${consumer.queue}` },
        messages: [{ $ref: `#/components/messages/${messageName}` }],
        description: `Consume message from ${consumer.queue}`,
      };
    }
  }

  const result: AsyncAPIDocument = {
    asyncapi: "3.0.0",
    info: {
      title: options.info.title ?? "AMQP Contract API",
      version: options.info.version ?? "1.0.0",
      ...options.info,
    },
    channels,
    operations,
    components: {
      messages,
    },
  };

  if (options.servers) {
    result.servers = options.servers;
  }

  return result;
}
