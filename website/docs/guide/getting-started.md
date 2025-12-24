# Getting Started

Welcome to **amqp-contract**! This guide will help you build type-safe AMQP messaging in minutes.

## What is amqp-contract?

amqp-contract brings end-to-end type safety to AMQP/RabbitMQ messaging. Define your contract once, and get automatic validation, type inference, and compile-time checks throughout your application.

## Installation

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
```

```bash [npm]
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
```

```bash [yarn]
yarn add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
```

:::

## Quick Start

### Step 1: Define Your Contract

Create a contract that defines your AMQP resources and message schemas:

```typescript
// contract.ts
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  definePublisher,
  defineConsumer,
  defineMessage,
} from '@amqp-contract/contract';
import { z } from 'zod';

// 1. Define resources
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

// 2. Define message
const orderMessage = defineMessage(
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
  })
);

// 3. Compose contract
export const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
  },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage, {
      prefetch: 10,
    }),
  },
});
```

### Step 2: Publish Messages

Use the type-safe client to publish messages:

```typescript
// publisher.ts
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

async function main() {
  const client = TypedAmqpClient.create({
    contract,
    urls: ['amqp://localhost']
  });

  const result = await client.publish('orderCreated', {
    orderId: 'ORD-123',
    customerId: 'CUST-456',
    amount: 99.99,
    items: [
      { productId: 'PROD-A', quantity: 2 },
      { productId: 'PROD-B', quantity: 1 },
    ],
  });

  if (result.isError()) {
    console.error('❌ Failed:', result.error.message);
  } else {
    console.log('✅ Order published!');
  }

  await client.close();
}

main();
```

### Step 3: Consume Messages

Create a worker with type-safe message handlers:

```typescript
// consumer.ts
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

async function main() {
  const workerResult = await TypedAmqpWorker.create({
    contract,
    handlers: {
      processOrder: async (message) => {
        // Message is fully typed!
        console.log(`Processing order: ${message.orderId}`);
        console.log(`Customer: ${message.customerId}`);
        console.log(`Amount: $${message.amount}`);
        console.log(`Items: ${message.items.length}`);

        for (const item of message.items) {
          console.log(`  - ${item.productId} x${item.quantity}`);
        }
      },
    },
    urls: ['amqp://localhost'],
  });

  if (workerResult.isError()) {
    throw workerResult.error;
  }

  const worker = workerResult.value;

  console.log('✅ Worker ready, waiting for messages...');
}

main();
```

## Key Benefits

- ✅ **Type Safety** - Full TypeScript inference from contract to handlers
- ✅ **Auto Validation** - Zod validates messages at publish and consume time
- ✅ **Compile Checks** - TypeScript catches errors before runtime
- ✅ **Better DX** - Autocomplete, refactoring, inline docs
- ✅ **Explicit Errors** - Result types for predictable error handling

## Next Steps

- Learn about [Core Concepts](/guide/core-concepts)
- Explore [Client Usage](/guide/client-usage) and [Worker Usage](/guide/worker-usage)
- Check out [Examples](/examples/)
- For NestJS: See [NestJS Client](/guide/client-nestjs-usage) and [NestJS Worker](/guide/worker-nestjs-usage)
