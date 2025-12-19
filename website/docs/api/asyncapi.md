# @amqp-contract/asyncapi

AsyncAPI 3.0 specification generator for AMQP contracts.

## Installation

```bash
pnpm add @amqp-contract/asyncapi
```

## Main Exports

### `generateAsyncAPI`

Generates an AsyncAPI 3.0.0 specification from a contract.

**Signature:**

```typescript
function generateAsyncAPI(
  contract: Contract,
  config: AsyncAPIConfig
): AsyncAPIDocument
```

**Example:**

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
import { contract } from './contract';

const spec = generateAsyncAPI(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
  },
  servers: {
    production: {
      host: 'rabbitmq.example.com:5671',
      protocol: 'amqps',
      description: 'Production RabbitMQ server (TLS)',
    },
  },
});
```

**Parameters:**

- `contract` - Contract definition created with `defineContract`
- `config` - AsyncAPI configuration object

**Returns:** AsyncAPI 3.0.0 specification document

---

## Configuration

### `AsyncAPIConfig`

```typescript
interface AsyncAPIConfig {
  info: InfoObject;
  servers: Record<string, ServerObject>;
  defaultContentType?: string;
  externalDocs?: ExternalDocsObject;
}
```

### `InfoObject`

API metadata:

```typescript
interface InfoObject {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
}
```

**Example:**

```typescript
info: {
  title: 'Order Processing API',
  version: '1.0.0',
  description: 'Type-safe AMQP messaging for order processing',
  contact: {
    name: 'API Team',
    email: 'api@example.com',
    url: 'https://example.com/support',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
  termsOfService: 'https://example.com/terms',
}
```

### `ServerObject`

Server configuration:

```typescript
interface ServerObject {
  host: string;
  protocol: 'amqp' | 'amqps';
  description?: string;
  variables?: Record<string, ServerVariableObject>;
  security?: Array<SecurityRequirementObject>;
  tags?: Array<TagObject>;
  bindings?: ServerBindingsObject;
}
```

**Example:**

```typescript
servers: {
  production: {
    host: 'prod.rabbitmq.com:5671',
    protocol: 'amqps',
    description: 'Production RabbitMQ server (TLS)',
    tags: [
      { name: 'production' },
      { name: 'stable' },
    ],
  },
  development: {
    host: 'localhost:5672',
    protocol: 'amqp',
    description: 'Local development server',
    tags: [{ name: 'development' }],
  },
}
```

### `ContactObject`

```typescript
interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}
```

### `LicenseObject`

```typescript
interface LicenseObject {
  name: string;
  url?: string;
}
```

### `ExternalDocsObject`

```typescript
interface ExternalDocsObject {
  description?: string;
  url: string;
}
```

**Example:**

```typescript
externalDocs: {
  description: 'Find more info here',
  url: 'https://docs.example.com',
}
```

---

## Generated Specification

The generated AsyncAPI document includes:

### Channels

AMQP exchanges and queues from your contract:

```json
{
  "channels": {
    "orders": {
      "address": "orders",
      "messages": {
        "orderCreated": { "$ref": "#/components/messages/orderCreated" }
      },
      "bindings": {
        "amqp": {
          "is": "routingKey",
          "exchange": {
            "name": "orders",
            "type": "topic",
            "durable": true
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

### Components

Message schemas and reusable definitions:

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

---

## Schema Conversion

amqp-contract automatically converts schemas to JSON Schema:

### Zod to JSON Schema

```typescript
// Zod schema
z.string().min(3).max(100)

// Becomes JSON Schema
{
  "type": "string",
  "minLength": 3,
  "maxLength": 100
}
```

```typescript
// Zod schema
z.number().positive().int()

// Becomes JSON Schema
{
  "type": "integer",
  "minimum": 0,
  "exclusiveMinimum": true
}
```

### Type Mappings

| Zod Type           | JSON Schema Type                            |
| ------------------ | ------------------------------------------- |
| `z.string()`       | `{ "type": "string" }`                      |
| `z.number()`       | `{ "type": "number" }`                      |
| `z.number().int()` | `{ "type": "integer" }`                     |
| `z.boolean()`      | `{ "type": "boolean" }`                     |
| `z.array(T)`       | `{ "type": "array", "items": T }`           |
| `z.object({...})`  | `{ "type": "object", "properties": {...} }` |
| `z.enum([...])`    | `{ "enum": [...] }`                         |
| `z.union([...])`   | `{ "oneOf": [...] }`                        |
| `z.optional()`     | Removes from `required` array               |
| `z.nullable()`     | `{ "type": ["...", "null"] }`               |

---

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
    description: 'Type-safe AMQP messaging API',
    contact: {
      name: 'API Team',
      email: 'api@example.com',
      url: 'https://example.com/support',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: {
    production: {
      host: 'prod.rabbitmq.com:5671',
      protocol: 'amqps',
      description: 'Production RabbitMQ server (TLS)',
      tags: [{ name: 'production' }],
    },
    staging: {
      host: 'staging.rabbitmq.com:5671',
      protocol: 'amqps',
      description: 'Staging environment (TLS)',
      tags: [{ name: 'staging' }],
    },
    development: {
      host: 'localhost:5672',
      protocol: 'amqp',
      description: 'Local development',
      tags: [{ name: 'development' }],
    },
  },
  externalDocs: {
    description: 'Full documentation',
    url: 'https://docs.example.com',
  },
});

// Export as JSON
writeFileSync('asyncapi.json', JSON.stringify(spec, null, 2));
console.log('✓ Generated asyncapi.json');

// Export as YAML
const yaml = YAML.stringify(spec);
writeFileSync('asyncapi.yaml', yaml);
console.log('✓ Generated asyncapi.yaml');

// Log summary
console.log('\nSpecification Summary:');
console.log('- Version:', spec.asyncapi);
console.log('- Channels:', Object.keys(spec.channels).length);
console.log('- Operations:', Object.keys(spec.operations).length);
console.log('- Servers:', Object.keys(spec.servers).length);
```

## Using Generated Specs

### AsyncAPI Studio

View in [AsyncAPI Studio](https://studio.asyncapi.com/):

1. Open https://studio.asyncapi.com/
2. Import your `asyncapi.json` or `asyncapi.yaml`
3. Explore interactive documentation

### AsyncAPI CLI

```bash
# Install CLI
npm install -g @asyncapi/cli

# Validate specification
asyncapi validate asyncapi.json

# Generate HTML documentation
asyncapi generate fromFile asyncapi.json @asyncapi/html-template -o docs/

# Generate Markdown documentation
asyncapi generate fromFile asyncapi.json @asyncapi/markdown-template -o docs/
```

### Code Generation

Generate client/server code:

```bash
# Node.js
asyncapi generate fromFile asyncapi.json @asyncapi/nodejs-template -o generated/

# Python
asyncapi generate fromFile asyncapi.json @asyncapi/python-paho-template -o generated/
```

---

## Advanced Configuration

### Server Variables

```typescript
servers: {
  production: {
    host: '{environment}.rabbitmq.com:{port}',
    protocol: 'amqps',
    variables: {
      environment: {
        default: 'prod',
        enum: ['prod', 'staging'],
        description: 'Environment name',
      },
      port: {
        default: '5671',
        description: 'AMQPS port (TLS)',
      },
    },
  },
}
```

### Security Requirements

```typescript
servers: {
  production: {
    host: 'prod.rabbitmq.com:5671',
    protocol: 'amqps',
    description: 'Production server (TLS)',
    security: [
      { user: [] },
      { apiKey: [] },
    ],
  },
}
```

### Adding Descriptions

Add descriptions to schemas for better documentation:

```typescript
const orderSchema = z.object({
  orderId: z.string().describe('Unique order identifier'),
  amount: z.number().positive().describe('Order amount in USD'),
  status: z.enum(['pending', 'completed'])
    .describe('Current order status'),
});
```

These descriptions appear in the generated AsyncAPI documentation.

---

## Best Practices

1. **Version Control** - Commit generated specs to track changes
2. **CI/CD** - Automate generation in your build pipeline
3. **Descriptions** - Add descriptions to schemas for clarity
4. **Multiple Servers** - Document all environments
5. **Validation** - Validate specs with AsyncAPI CLI
6. **Documentation** - Use AsyncAPI tools to generate docs
7. **Keep Synced** - Regenerate when contracts change

## See Also

- [AsyncAPI Generation Guide](/guide/asyncapi-generation)
- [AsyncAPI Generation Example](/examples/asyncapi-generation)
- [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
- [Contract API](/api/contract)
