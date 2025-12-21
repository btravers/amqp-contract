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
- ✅ **Automatic validation** — Schema validation with Zod, Valibot, or ArkType
- ✅ **Compile-time checks** — TypeScript catches missing or incorrect implementations
- ✅ **NestJS integration** — First-class support with automatic lifecycle management
- ✅ **AsyncAPI generation** — Generate AsyncAPI 3.0 specs from contracts
- ✅ **Better DX** — Autocomplete, refactoring support, inline documentation

## Quick Example

```typescript
import { defineContract, defineExchange, defineQueue, definePublisher, defineConsumer, defineBinding } from '@amqp-contract/contract';
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
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

// Client - fully typed publishing with explicit error handling
const client = await TypedAmqpClient.create({ contract, connection });
const result = client.publish('orderCreated', {
  orderId: 'ORD-123',  // ✅ TypeScript knows!
  amount: 99.99,
});

// Handle errors explicitly using Result type
if (result.isError()) {
  console.error('Failed to publish:', result.error);
  // result.error is TechnicalError or MessageValidationError
} else {
  console.log('Published successfully');
}

// Worker - fully typed consuming
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId);  // ✅ TypeScript knows!
    },
  },
  connection,
});
```

## Installation

```bash
# Core packages
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker

# For NestJS applications
pnpm add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

## NestJS Integration

Use the dedicated NestJS packages for automatic lifecycle management:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
import { contract } from './contract';

@Module({
  imports: [
    // Worker for consuming messages
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing:', message.orderId);
        },
      },
      connection: 'amqp://localhost',
    }),
    // Client for publishing messages
    AmqpClientModule.forRoot({
      contract,
      connection: 'amqp://localhost',
    }),
  ],
})
export class AppModule {}
```

📖 **[NestJS Documentation →](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage)**

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

- [Getting Started](https://btravers.github.io/amqp-contract/guide/getting-started)
- [Core Concepts](https://btravers.github.io/amqp-contract/guide/core-concepts)
- [NestJS Client Usage](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage)
- [NestJS Worker Usage](https://btravers.github.io/amqp-contract/guide/worker-nestjs-usage)
- [AsyncAPI Generation](https://btravers.github.io/amqp-contract/guide/asyncapi-generation)
- [API Reference](https://btravers.github.io/amqp-contract/api/)
- [Examples](https://btravers.github.io/amqp-contract/examples/)

## Packages

| Package                                                  | Description                              |
| -------------------------------------------------------- | ---------------------------------------- |
| [@amqp-contract/contract](./packages/contract)           | Contract builder and type definitions    |
| [@amqp-contract/client](./packages/client)               | Type-safe client for publishing messages |
| [@amqp-contract/worker](./packages/worker)               | Type-safe worker for consuming messages  |
| [@amqp-contract/client-nestjs](./packages/client-nestjs) | NestJS integration for client            |
| [@amqp-contract/worker-nestjs](./packages/worker-nestjs) | NestJS integration for worker            |
| [@amqp-contract/asyncapi](./packages/asyncapi)           | AsyncAPI 3.0 specification generator     |
| [@amqp-contract/zod](./packages/zod)                     | Zod schema integration                   |
| [@amqp-contract/valibot](./packages/valibot)             | Valibot schema integration               |
| [@amqp-contract/arktype](./packages/arktype)             | ArkType schema integration               |

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
