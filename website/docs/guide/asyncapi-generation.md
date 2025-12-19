# AsyncAPI Generation

Generate AsyncAPI 3.0 specifications from your AMQP contracts for documentation and tooling.

## Installation

Install the AsyncAPI package:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/asyncapi
```

```bash [npm]
npm install @amqp-contract/asyncapi
```

```bash [yarn]
yarn add @amqp-contract/asyncapi
```

:::

## Basic Usage

Generate an AsyncAPI specification from your contract:

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
import { contract } from './contract';

const spec = generateAsyncAPI(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
    description: 'Type-safe AMQP messaging API for order processing',
  },
  servers: {
    production: {
      host: 'rabbitmq.example.com:5672',
      protocol: 'amqp',
      description: 'Production RabbitMQ server',
    },
    development: {
      host: 'localhost:5672',
      protocol: 'amqp',
      description: 'Local development server',
    },
  },
});

console.log(JSON.stringify(spec, null, 2));
```

## Generated Specification

The generated AsyncAPI specification includes:

### Channels

Exchanges and queues from your contract:

```json
{
  "channels": {
    "orders": {
      "address": "orders",
      "messages": {
        "orderCreated": { ... }
      },
      "bindings": {
        "amqp": {
          "is": "routingKey",
          "exchange": {
            "name": "orders",
            "type": "topic"
          }
        }
      }
    }
  }
}
```

### Operations

Send (publish) and receive (consume) operations:

```json
{
  "operations": {
    "publishOrderCreated": {
      "action": "send",
      "channel": { "$ref": "#/channels/orders" },
      "messages": [
        { "$ref": "#/channels/orders/messages/orderCreated" }
      ]
    },
    "consumeProcessOrder": {
      "action": "receive",
      "channel": { "$ref": "#/channels/order-processing" },
      "messages": [
        { "$ref": "#/channels/order-processing/messages/processOrder" }
      ]
    }
  }
}
```

### Messages

Message schemas with Zod-to-JSON Schema conversion:

```json
{
  "components": {
    "messages": {
      "orderCreated": {
        "payload": {
          "type": "object",
          "properties": {
            "orderId": { "type": "string" },
            "amount": { "type": "number" }
          },
          "required": ["orderId", "amount"]
        }
      }
    }
  }
}
```

## Configuration Options

### Server Configuration

Define multiple servers for different environments:

```typescript
const spec = generateAsyncAPI(contract, {
  info: {
    title: 'My API',
    version: '1.0.0',
  },
  servers: {
    production: {
      host: 'prod.rabbitmq.com:5672',
      protocol: 'amqp',
      description: 'Production server',
      security: [{ user: [] }],
      tags: [{ name: 'production' }],
    },
    staging: {
      host: 'staging.rabbitmq.com:5672',
      protocol: 'amqp',
      description: 'Staging server',
    },
    development: {
      host: 'localhost:5672',
      protocol: 'amqp',
      description: 'Local development',
    },
  },
});
```

### API Information

Add detailed API metadata:

```typescript
const spec = generateAsyncAPI(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
    description: 'Comprehensive order processing system',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
      url: 'https://example.com/support',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    termsOfService: 'https://example.com/terms',
  },
  servers: { ... },
});
```

## Exporting Specifications

### JSON Export

```typescript
import { writeFileSync } from 'fs';
import { generateAsyncAPI } from '@amqp-contract/asyncapi';

const spec = generateAsyncAPI(contract, { ... });

// Write to file
writeFileSync('asyncapi.json', JSON.stringify(spec, null, 2));
```

### YAML Export

```typescript
import { writeFileSync } from 'fs';
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
import YAML from 'yaml';

const spec = generateAsyncAPI(contract, { ... });

// Convert to YAML
const yaml = YAML.stringify(spec);
writeFileSync('asyncapi.yaml', yaml);
```

## Using Generated Specifications

### AsyncAPI Studio

Visualize and edit your API in [AsyncAPI Studio](https://studio.asyncapi.com/):

1. Generate your specification
2. Copy the JSON or YAML
3. Paste into AsyncAPI Studio
4. View interactive documentation

### AsyncAPI Generator

Generate code, documentation, and more:

```bash
# Install AsyncAPI CLI
npm install -g @asyncapi/cli

# Generate HTML documentation
asyncapi generate fromFile asyncapi.json @asyncapi/html-template -o docs/

# Generate Markdown documentation
asyncapi generate fromFile asyncapi.json @asyncapi/markdown-template -o docs/
```

### AsyncAPI CLI

Validate and work with specifications:

```bash
# Validate specification
asyncapi validate asyncapi.json

# Convert formats
asyncapi convert asyncapi.json asyncapi.yaml

# Start AsyncAPI Studio locally
asyncapi start studio
```

## Schema Support

amqp-contract supports multiple schema libraries through Standard Schema:

### Zod (Recommended)

```typescript
import { z } from 'zod';

const orderSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
});
```

### Valibot

```typescript
import * as v from 'valibot';

const orderSchema = v.object({
  orderId: v.string(),
  amount: v.pipe(v.number(), v.minValue(0)),
});
```

### ArkType

```typescript
import { type } from 'arktype';

const orderSchema = type({
  orderId: 'string',
  amount: 'number>0',
});
```

All schemas are automatically converted to JSON Schema in the AsyncAPI specification.

## Complete Example

```typescript
import { writeFileSync } from 'fs';
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
import { contract } from './contract';
import YAML from 'yaml';

// Generate specification
const spec = generateAsyncAPI(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
    description: 'Type-safe AMQP messaging for order processing',
    contact: {
      name: 'API Team',
      email: 'api@example.com',
    },
  },
  servers: {
    production: {
      host: 'prod.rabbitmq.com:5672',
      protocol: 'amqp',
      description: 'Production RabbitMQ server',
    },
    development: {
      host: 'localhost:5672',
      protocol: 'amqp',
      description: 'Local development server',
    },
  },
});

// Export as JSON
writeFileSync('asyncapi.json', JSON.stringify(spec, null, 2));
console.log('✓ Generated asyncapi.json');

// Export as YAML
const yaml = YAML.stringify(spec);
writeFileSync('asyncapi.yaml', yaml);
console.log('✓ Generated asyncapi.yaml');

// Validate (optional)
console.log('AsyncAPI version:', spec.asyncapi);
console.log('Channels:', Object.keys(spec.channels).length);
console.log('Operations:', Object.keys(spec.operations).length);
```

## Best Practices

1. **Version Control** - Commit generated specs to your repository
2. **CI/CD Integration** - Generate specs in your build pipeline
3. **Documentation** - Use AsyncAPI tools to generate human-readable docs
4. **Validation** - Validate specs with AsyncAPI CLI
5. **Keep Updated** - Regenerate specs when contracts change
6. **Add Metadata** - Include descriptions, examples, and contact info

## Next Steps

- See the [AsyncAPI Generation Example](/examples/asyncapi-generation)
- Learn about [Defining Contracts](/guide/defining-contracts)
- Explore the [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
