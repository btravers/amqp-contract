---
title: AsyncAPI Generation - Generate API Documentation from AMQP Contracts
description: Learn how to generate AsyncAPI 3.0 specifications from your type-safe AMQP contracts for automatic API documentation and tooling integration.
---

# AsyncAPI Generation

Generate AsyncAPI 3.0 specifications from your contracts for documentation and tooling.

## Installation

```bash
pnpm add @amqp-contract/asyncapi
```

## Basic Usage

```typescript
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { contract } from "./contract";

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: {
    title: "Order Processing API",
    version: "1.0.0",
    description: "Type-safe AMQP messaging for order processing",
  },
  servers: {
    production: {
      host: "rabbitmq.example.com:5671",
      protocol: "amqps",
      description: "Production server (TLS)",
    },
    development: {
      host: "localhost:5672",
      protocol: "amqp",
      description: "Local development",
    },
  },
});

console.log(JSON.stringify(spec, null, 2));
```

## Generated Specification

The specification includes:

- **Channels** - Exchanges and queues
- **Operations** - Send (publish) and receive (consume)
- **Messages** - Schemas automatically converted to JSON Schema
- **Bindings** - AMQP-specific routing configuration

## Configuration

### Server Configuration

Define multiple servers:

```typescript
const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: { title: "My API", version: "1.0.0" },
  servers: {
    production: {
      host: "prod.rabbitmq.com:5672",
      protocol: "amqp",
      description: "Production server",
    },
    staging: {
      host: "staging.rabbitmq.com:5672",
      protocol: "amqp",
      description: "Staging server",
    },
  },
});
```

### API Information

Add metadata:

```typescript
const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
    description: 'Order processing system',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: { ... },
});
```

## Exporting Specifications

### JSON Export

```typescript
import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { writeFileSync } from 'fs';

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, { ... });
writeFileSync('asyncapi.json', JSON.stringify(spec, null, 2));
```

### YAML Export

```typescript
import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { writeFileSync } from 'fs';
import YAML from 'yaml';

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, { ... });
writeFileSync('asyncapi.yaml', YAML.stringify(spec));
```

## Using Generated Specs

### AsyncAPI Studio

Visualize your API at [AsyncAPI Studio](https://studio.asyncapi.com/):

1. Generate your specification
2. Copy JSON or YAML
3. Paste into [AsyncAPI Studio](https://studio.asyncapi.com/)
4. View interactive documentation

### AsyncAPI CLI

Generate documentation and code:

```bash
# Install
npm install -g @asyncapi/cli

# Generate HTML docs
asyncapi generate fromFile asyncapi.json @asyncapi/html-template -o docs/

# Validate spec
asyncapi validate asyncapi.json
```

## Complete Example

```typescript
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { writeFileSync } from "fs";
import YAML from "yaml";

import { contract } from "./contract";

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: {
    title: "Order Processing API",
    version: "1.0.0",
    description: "Type-safe AMQP messaging",
    contact: {
      name: "API Team",
      email: "api@example.com",
    },
  },
  servers: {
    production: {
      host: "prod.rabbitmq.com:5672",
      protocol: "amqp",
      description: "Production server",
    },
  },
});

// Export
writeFileSync("asyncapi.json", JSON.stringify(spec, null, 2));
writeFileSync("asyncapi.yaml", YAML.stringify(spec));

console.log("✅ Generated AsyncAPI specs");
console.log("   Channels:", Object.keys(spec.channels).length);
console.log("   Operations:", Object.keys(spec.operations).length);
```

## Best Practices

1. **Version Control** - Commit generated specs
2. **CI/CD** - Generate in build pipeline
3. **Documentation** - Use AsyncAPI tools for docs
4. **Validation** - Validate with AsyncAPI CLI
5. **Keep Updated** - Regenerate when contracts change

## Next Steps

- See the [AsyncAPI Generation Example](/examples/asyncapi-generation)
- Learn about [Defining Contracts](/guide/defining-contracts)
- Explore [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
