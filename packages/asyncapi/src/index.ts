import type { ConditionalSchemaConverter } from "@orpc/openapi";
import type {
  AsyncAPIObject,
  ChannelsObject,
  OperationsObject,
  MessagesObject,
} from "@asyncapi/parser/esm/spec-types/v3";
import type { ContractDefinition } from "@amqp-contract/contract";

export interface AsyncAPIGeneratorOptions {
  schemaConverters?: ConditionalSchemaConverter[];
}

export type AsyncAPIGeneratorGenerateOptions = Pick<AsyncAPIObject, "id" | "info" | "servers">;

export class AsyncAPIGenerator {
  constructor(_options: AsyncAPIGeneratorOptions = {}) {
    // Schema converters will be used in future implementation
  }

  /**
   * Generate an AsyncAPI 3.0 document from a contract definition
   *
   * TODO: This is a stub implementation that returns an empty AsyncAPI document.
   * Future implementation should:
   * - Convert exchanges to AsyncAPI channels
   * - Convert publishers/consumers to AsyncAPI operations
   * - Convert message definitions to AsyncAPI messages with JSON Schema
   * - Use schema converters to convert Standard Schema to JSON Schema
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
}
