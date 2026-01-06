**@amqp-contract/asyncapi**

---

# @amqp-contract/asyncapi

## Classes

### AsyncAPIGenerator

Defined in: [index.ts:92](https://github.com/btravers/amqp-contract/blob/63bb54252f8a9109544152686427ef223964c15c/packages/asyncapi/src/index.ts#L92)

Generator for creating AsyncAPI 3.0 documentation from AMQP contracts.

This class converts contract definitions into AsyncAPI 3.0 specification documents,
which can be used for API documentation, code generation, and tooling integration.

#### Example

```typescript
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { zodToJsonSchema } from "@orpc/zod";
import { z } from "zod";

const contract = defineContract({
  exchanges: {
    orders: defineExchange("orders", "topic", { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher(
      "orders",
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
      {
        routingKey: "order.created",
      },
    ),
  },
});

const generator = new AsyncAPIGenerator({
  schemaConverters: [zodToJsonSchema],
});

const asyncapi = await generator.generate(contract, {
  id: "urn:com:example:order-service",
  info: {
    title: "Order Service API",
    version: "1.0.0",
    description: "Async API for order processing",
  },
  servers: {
    production: {
      host: "rabbitmq.example.com",
      protocol: "amqp",
      protocolVersion: "0.9.1",
    },
  },
});
```

#### Constructors

##### Constructor

```ts
new AsyncAPIGenerator(options): AsyncAPIGenerator;
```

Defined in: [index.ts:100](https://github.com/btravers/amqp-contract/blob/63bb54252f8a9109544152686427ef223964c15c/packages/asyncapi/src/index.ts#L100)

Create a new AsyncAPI generator instance.

###### Parameters

| Parameter | Type                                                    | Description                                       |
| --------- | ------------------------------------------------------- | ------------------------------------------------- |
| `options` | [`AsyncAPIGeneratorOptions`](#asyncapigeneratoroptions) | Configuration options including schema converters |

###### Returns

[`AsyncAPIGenerator`](#asyncapigenerator)

#### Methods

##### generate()

```ts
generate(contract, options): Promise<AsyncAPIObject>;
```

Defined in: [index.ts:132](https://github.com/btravers/amqp-contract/blob/63bb54252f8a9109544152686427ef223964c15c/packages/asyncapi/src/index.ts#L132)

Generate an AsyncAPI 3.0 document from a contract definition.

Converts AMQP exchanges, queues, publishers, and consumers into
AsyncAPI channels, operations, and messages with proper JSON Schema
validation definitions.

###### Parameters

| Parameter  | Type                                                                    | Description                                    |
| ---------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `contract` | `ContractDefinition`                                                    | The AMQP contract definition to convert        |
| `options`  | [`AsyncAPIGeneratorGenerateOptions`](#asyncapigeneratorgenerateoptions) | AsyncAPI document metadata (id, info, servers) |

###### Returns

`Promise`\<`AsyncAPIObject`\>

Promise resolving to a complete AsyncAPI 3.0 document

###### Example

```typescript
const asyncapi = await generator.generate(contract, {
  id: "urn:com:example:api",
  info: {
    title: "My API",
    version: "1.0.0",
  },
  servers: {
    dev: {
      host: "localhost:5672",
      protocol: "amqp",
    },
  },
});
```

## Interfaces

### AsyncAPIGeneratorOptions

Defined in: [index.ts:31](https://github.com/btravers/amqp-contract/blob/63bb54252f8a9109544152686427ef223964c15c/packages/asyncapi/src/index.ts#L31)

Options for configuring the AsyncAPI generator.

#### Example

```typescript
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { zodToJsonSchema } from "@orpc/zod";

const generator = new AsyncAPIGenerator({
  schemaConverters: [zodToJsonSchema],
});
```

#### Properties

| Property                                          | Type                           | Description                                                                                                                                              | Defined in                                                                                                                                |
| ------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="schemaconverters"></a> `schemaConverters?` | `ConditionalSchemaConverter`[] | Schema converters for transforming validation schemas to JSON Schema. Supports Zod, Valibot, ArkType, and other Standard Schema v1 compatible libraries. | [index.ts:36](https://github.com/btravers/amqp-contract/blob/63bb54252f8a9109544152686427ef223964c15c/packages/asyncapi/src/index.ts#L36) |

## Type Aliases

### AsyncAPIGeneratorGenerateOptions

```ts
type AsyncAPIGeneratorGenerateOptions = Pick<AsyncAPIObject, "id" | "info" | "servers">;
```

Defined in: [index.ts:43](https://github.com/btravers/amqp-contract/blob/63bb54252f8a9109544152686427ef223964c15c/packages/asyncapi/src/index.ts#L43)

Options for generating an AsyncAPI document.
These correspond to the top-level AsyncAPI document fields.
