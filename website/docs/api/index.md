# API Overview

The amqp-contract library consists of four main packages:

## Packages

### [@amqp-contract/contract](/api/contract)

The core package for defining AMQP contracts.

```typescript
import { defineContract, defineExchange, defineQueue } from '@amqp-contract/contract';
```

**Key exports:**
- `defineContract` - Define a complete AMQP contract
- `defineExchange` - Define an exchange
- `defineQueue` - Define a queue
- `defineBinding` - Define a binding
- `definePublisher` - Define a publisher with schema
- `defineConsumer` - Define a consumer with schema

### [@amqp-contract/client](/api/client)

Type-safe client for publishing messages.

```typescript
import { createClient } from '@amqp-contract/client';
```

**Key exports:**
- `createClient` - Create a type-safe AMQP client
- `AmqpClient` - The client class type

### [@amqp-contract/worker](/api/worker)

Type-safe worker for consuming messages.

```typescript
import { createWorker } from '@amqp-contract/worker';
```

**Key exports:**
- `createWorker` - Create a type-safe AMQP worker
- `AmqpWorker` - The worker class type

### [@amqp-contract/asyncapi](/api/asyncapi)

Generate AsyncAPI 3.0 specifications from contracts.

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
```

**Key exports:**
- `generateAsyncAPI` - Generate AsyncAPI specification
- Various TypeScript types for AsyncAPI documents

## Type Inference

All packages leverage TypeScript's type inference:

```typescript
// Types are inferred from the contract
const contract = defineContract({
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
    })),
  },
});

// Client knows about 'orderCreated' and its schema
const client = createClient(contract);
await client.publish('orderCreated', { orderId: 'ORD-123' });

// Worker handler is fully typed
const worker = createWorker(contract, {
  processOrder: async (message) => {
    message.orderId; // string
  },
});
```

## Common Types

### ContractDefinition

The base type for all contracts:

```typescript
interface ContractDefinition {
  exchanges?: Record<string, ExchangeDefinition>;
  queues?: Record<string, QueueDefinition>;
  bindings?: Record<string, BindingDefinition>;
  publishers?: Record<string, PublisherDefinition>;
  consumers?: Record<string, ConsumerDefinition>;
}
```

### Schema Types

amqp-contract uses Standard Schema, supporting:

- Zod
- Valibot
- ArkType
- Any Standard Schema-compatible library

## Next Steps

- Explore the [@amqp-contract/contract](/api/contract) API
- Learn about the [@amqp-contract/client](/api/client) API
- Understand the [@amqp-contract/worker](/api/worker) API
- Check out [@amqp-contract/asyncapi](/api/asyncapi) generation
