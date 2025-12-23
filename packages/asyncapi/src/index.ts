import { ConditionalSchemaConverter, JSONSchema } from "@orpc/openapi";
import {
  AsyncAPIObject,
  ChannelsObject,
  OperationsObject,
  MessagesObject,
  MessageObject,
} from "@asyncapi/parser/esm/spec-types/v3";
import { ContractDefinition } from "@amqp-contract/contract";
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
    _contract: ContractDefinition,
    options: AsyncAPIGeneratorGenerateOptions,
  ): Promise<AsyncAPIObject> {
    const convertedChannels: ChannelsObject = {};
    const convertedOperations: OperationsObject = {};
    const convertedMessages: MessagesObject = {};

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
   * Convert a message's Standard Schema payload to JSON Schema
   */
  private async convertMessage(message: Message): Promise<MessageObject> {
    const payload = message.payload;

    // Convert payload schema
    const payloadJsonSchema = await this.convertSchema(payload, "input");

    // Build result by only including JSON-serializable properties
    return {
      payload: payloadJsonSchema,
      contentType: "application/json",
      headers: message.headers,
      summary: message.summary,
      description: message.description,
    };
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
