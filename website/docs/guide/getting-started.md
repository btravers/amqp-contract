# Getting Started

Welcome to **amqp-contract**! This guide will help you get up and running quickly.

## What is amqp-contract?

amqp-contract is a TypeScript library that provides end-to-end type safety for AMQP/RabbitMQ messaging. It follows a contract-first approach where you define your message schemas once, and type safety flows throughout your application.

## Key Features

- 🔒 **End-to-end type safety** from contract to client and worker
- ✅ **Automatic validation** using Zod schemas
- 🛠️ **Compile-time checks** catch errors before runtime
- 📄 **AsyncAPI generation** for documentation
- 🚀 **Better DX** with full autocomplete and refactoring support

## Installation

Install the packages you need:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
pnpm add amqplib zod
```

```bash [npm]
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
npm install amqplib zod
```

```bash [yarn]
yarn add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
yarn add amqplib zod
```

:::

## Basic Example

### 1. Define Your Contract

Create a contract that defines your AMQP resources and message schemas:

```typescript
// contract.ts
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineBinding,
  definePublisher,
  defineConsumer,
} from '@amqp-contract/contract';
import { z } from 'zod';

export const orderContract = defineContract({
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
    orderCreated: definePublisher(
      'orders',
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        amount: z.number().positive(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
          })
        ),
      }),
      { routingKey: 'order.created' }
    ),
  },
  consumers: {
    processOrder: defineConsumer(
      'order-processing',
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        amount: z.number().positive(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
          })
        ),
      }),
      { prefetch: 10 }
    ),
  },
});
```

### 2. Publish Messages (Client)

Use the type-safe client to publish messages:

```typescript
// publisher.ts
import { TypedAmqpClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { orderContract } from './contract';

async function main() {
  const connection = await connect('amqp://localhost');
  const client = await createClient({ contract: orderContract, connection });

  // Type-safe publishing with validation
  await client.publish('orderCreated', {
    orderId: 'ORD-123',
    customerId: 'CUST-456',
    amount: 99.99,
    items: [
      { productId: 'PROD-A', quantity: 2 },
      { productId: 'PROD-B', quantity: 1 },
    ],
  });

  console.log('Order published!');
  await client.close();
}

main();
```

### 3. Consume Messages (Worker)

Create a worker with type-safe message handlers:

```typescript
// consumer.ts
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { orderContract } from './contract';

async function main() {
  const connection = await connect('amqp://localhost');

  const worker = await TypedAmqpWorker.create({
    contract: orderContract,
    handlers: {
      processOrder: async (message) => {
        // message is fully typed!
        console.log(`Processing order: ${message.orderId}`);
        console.log(`Customer: ${message.customerId}`);
        console.log(`Amount: $${message.amount}`);
        console.log(`Items: ${message.items.length}`);

        // Your business logic here
        for (const item of message.items) {
          console.log(`  - ${item.productId} x${item.quantity}`);
        }
      },
    },
    connection,
  });

  console.log('Worker ready, waiting for messages...');
}

main();
```

## What's Next?

- Learn about [Core Concepts](/guide/core-concepts)
- Explore [API Documentation](/api/)
- Check out [Examples](/examples/)
- Generate [AsyncAPI specifications](/guide/asyncapi-generation)
