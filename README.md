<div align="center">

# amqp-contract

**Type-safe contracts for AMQP/RabbitMQ**

End-to-end type safety and automatic validation for AMQP messaging

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/contract.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/contract)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**Documentation**](https://btravers.github.io/amqp-contract) · [**Get Started**](https://btravers.github.io/amqp-contract/guide/getting-started) · [**Examples**](https://btravers.github.io/amqp-contract/examples/)

</div>

## Features

- ✅ **End-to-end type safety** — From contract to client and worker
- ✅ **Automatic validation** — Zod schemas validate at all network boundaries
- ✅ **Compile-time checks** — TypeScript catches missing or incorrect implementations
- ✅ **AsyncAPI generation** — Generate AsyncAPI 3.0 specs from contracts
- ✅ **Better DX** — Autocomplete, refactoring support, inline documentation

## Quick Example

```typescript
import { defineContract, defineExchange, defineQueue, definePublisher, defineConsumer, defineBinding } from '@amqp-contract/contract';
import { createClient } from '@amqp-contract/client';
import { createWorker } from '@amqp-contract/worker';
import { z } from 'zod';

// Define contract once
const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
  },
  bindings: {
    orderBinding: defineBinding('order-processing', 'orders', {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
      amount: z.number(),
    }), {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', z.object({
      orderId: z.string(),
      amount: z.number(),
    })),
  },
});

// Client - fully typed publishing
const client = createClient(contract);
await client.connect(connection);
await client.publish('orderCreated', {
  orderId: 'ORD-123',  // ✅ TypeScript knows!
  amount: 99.99,
});

// Worker - fully typed consuming
const worker = createWorker(contract, {
  processOrder: async (message) => {
    console.log(message.orderId);  // ✅ TypeScript knows!
  },
});
await worker.connect(connection);
await worker.consumeAll();
```

## Installation

```bash
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
```

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

- [Getting Started](https://btravers.github.io/amqp-contract/guide/getting-started)
- [Core Concepts](https://btravers.github.io/amqp-contract/guide/core-concepts)
- [AsyncAPI Generation](https://btravers.github.io/amqp-contract/guide/asyncapi-generation)
- [API Reference](https://btravers.github.io/amqp-contract/api/)
- [Examples](https://btravers.github.io/amqp-contract/examples/)

## Packages

| Package                                        | Description                              |
| ---------------------------------------------- | ---------------------------------------- |
| [@amqp-contract/contract](./packages/contract) | Contract builder and type definitions    |
| [@amqp-contract/client](./packages/client)     | Type-safe client for publishing messages |
| [@amqp-contract/worker](./packages/worker)     | Type-safe worker for consuming messages  |
| [@amqp-contract/asyncapi](./packages/asyncapi) | AsyncAPI 3.0 specification generator     |

## AsyncAPI Generation

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';

const spec = generateAsyncAPI(contract, {
  info: {
    title: 'My AMQP API',
    version: '1.0.0',
  },
  servers: {
    production: {
      host: 'rabbitmq.example.com:5672',
      protocol: 'amqp',
    },
  },
});
```

## Contributing

See [CONTRIBUTING.md](https://github.com/btravers/amqp-contract/blob/main/CONTRIBUTING.md).

## License

MIT
