import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AsyncAPISchema } from "./generator.js";

/**
 * Convert a Standard Schema to JSON Schema (AsyncAPI format)
 *
 * This is a basic converter that returns a generic object schema.
 * Users should provide their own schema-to-JSON-Schema converter function
 * specific to their schema library.
 *
 * For Zod users, import and use zodToJsonSchema from @amqp-contract/zod
 *
 * @example
 * ```ts
 * import { zodToJsonSchema } from '@amqp-contract/zod';
 * import { generateAsyncAPI } from '@amqp-contract/asyncapi';
 *
 * // Use zodToJsonSchema for converting Zod schemas
 * const jsonSchema = zodToJsonSchema(zodSchema);
 * ```
 */
export function standardSchemaToJsonSchema(_schema: StandardSchemaV1): AsyncAPISchema {
  // Basic fallback - returns a generic object schema
  // Users should provide their own converter for better results
  return { type: "object" };
}
