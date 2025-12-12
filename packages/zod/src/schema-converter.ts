import type { AsyncAPISchema } from "@amqp-contract/asyncapi";

/**
 * Convert a Zod schema to JSON Schema (AsyncAPI format)
 *
 * This converter specifically handles Zod schemas and converts them
 * to JSON Schema format compatible with AsyncAPI.
 */
export function zodToJsonSchema(schema: Record<string, unknown>): AsyncAPISchema {
  // Handle Zod structure
  if (typeof schema !== "object" || schema === null) {
    return { type: "object" };
  }

  // Get the schema type - Zod 4.x uses `type` at top level
  const schemaType = schema.type;
  const def = schema.def as Record<string, unknown> | undefined;

  // Handle different Zod types based on the type field
  if (schemaType === "object") {
    // For Zod objects, shape is in def.shape
    const shape = def?.shape as Record<string, unknown> | undefined;
    if (!shape) {
      return { type: "object" };
    }

    const properties: Record<string, AsyncAPISchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as Record<string, unknown>);

      // Check if optional - optional schemas have type "optional"
      const valueType = (value as Record<string, unknown>)?.type;
      if (valueType !== "optional") {
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
  }

  if (schemaType === "string") {
    return { type: "string" };
  }

  if (schemaType === "number") {
    return { type: "number" };
  }

  if (schemaType === "boolean") {
    return { type: "boolean" };
  }

  if (schemaType === "array") {
    // For arrays, the element type is in def.element
    const element = def?.element as Record<string, unknown> | undefined;
    return {
      type: "array",
      items: element ? zodToJsonSchema(element) : { type: "object" },
    };
  }

  if (schemaType === "optional") {
    // For optional types, get the inner type
    const innerType = def?.innerType as Record<string, unknown> | undefined;
    return innerType ? zodToJsonSchema(innerType) : { type: "object" };
  }

  if (schemaType === "enum" || schemaType === "nativeEnum") {
    // For enums, values are in def.values
    const values = def?.values as unknown[] | undefined;
    return {
      type: "string",
      enum: values || [],
    };
  }

  // Default fallback
  return { type: "object" };
}
