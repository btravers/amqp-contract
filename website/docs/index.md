---
layout: home

hero:
  name: "amqp-contract"
  text: "Type-safe contracts for AMQP/RabbitMQ"
  tagline: End-to-end type safety and automatic validation for AMQP messaging with AsyncAPI generation
  image:
    src: /logo.svg
    alt: amqp-contract
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/btravers/amqp-contract
    - theme: alt
      text: Examples
      link: /examples/

features:
  - icon: 🔒
    title: End-to-end Type Safety
    details: Full TypeScript inference from contract to client and worker. No manual type annotations needed.
  
  - icon: ✅
    title: Automatic Validation
    details: Schema validation at network boundaries with Zod, Valibot, or ArkType. No runtime surprises.
  
  - icon: 🛠️
    title: Compile-time Checks
    details: TypeScript catches missing or incorrect implementations before runtime. Refactor with confidence.
  
  - icon: 🚀
    title: Better Developer Experience
    details: Full autocomplete, inline documentation, and refactoring support throughout your codebase.
  
  - icon: 📝
    title: Contract-First Design
    details: Define your AMQP interface once with schemas — types and validation flow from there.
  
  - icon: 📄
    title: AsyncAPI Generation
    details: Automatically generate AsyncAPI 3.0 specifications from your contracts for documentation and tooling.

  - icon: 🎯
    title: NestJS Integration
    details: First-class NestJS support with automatic lifecycle management and dependency injection.

  - icon: 🔌
    title: Framework Agnostic
    details: Use with any framework or none at all. Core packages work anywhere TypeScript runs.
---

## The Problem

Working with RabbitMQ/AMQP messaging is powerful, but comes with challenges:

```typescript
// ❌ No type safety
channel.publish('orders', 'order.created', Buffer.from(JSON.stringify({
  orderId: 'ORD-123'  // What fields? What types?
})));

channel.consume('order-processing', (msg) => {
  const data = JSON.parse(msg.content.toString());  // unknown type
  console.log(data.orderId);  // No autocomplete, no validation
});

// ❌ Manual validation everywhere
// ❌ Runtime errors from wrong data
// ❌ Scattered message definitions
```

## The Solution

**amqp-contract** transforms your AMQP messaging with a contract-first approach:

```typescript
// ✅ Define once
const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
      customerId: z.string(),
      amount: z.number(),
    })),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', z.object({
      orderId: z.string(),
      customerId: z.string(),
      amount: z.number(),
    })),
  },
});

// ✅ Type-safe client with explicit error handling
const client = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://localhost'
});

const result = client.publish('orderCreated', {
  orderId: 'ORD-123',      // TypeScript knows!
  customerId: 'CUST-456',
  amount: 99.99,
});

if (result.isError()) {
  console.error('Failed:', result.error);
}

// ✅ Type-safe worker
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId);  // ✅ Fully typed!
    },
  },
  connection: 'amqp://localhost',
});
```

## Quick Example

See how easy it is to get started:

::: code-group

```typescript [contract.ts]
import { defineContract, defineExchange, defineQueue, definePublisher, defineConsumer } from '@amqp-contract/contract';
import { z } from 'zod';

export const orderContract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
      amount: z.number(),
    })),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', z.object({
      orderId: z.string(),
      amount: z.number(),
    })),
  },
});
```

```typescript [client.ts]
import { TypedAmqpClient } from '@amqp-contract/client';
import { orderContract } from './contract';

const client = await TypedAmqpClient.create({
  contract: orderContract,
  connection: 'amqp://localhost'
});

// Type-safe publishing with explicit error handling
const result = client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

if (result.isError()) {
  console.error('Failed:', result.error);
}
```

```typescript [worker.ts]
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { orderContract } from './contract';

const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: async (message) => {
      console.log(`Processing order: ${message.orderId}`);
      console.log(`Amount: $${message.amount}`);
    },
  },
  connection: 'amqp://localhost',
});
```

:::

## AsyncAPI Generation

Generate AsyncAPI 3.0 specifications automatically:

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';

const spec = generateAsyncAPI(orderContract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
  },
  servers: {
    production: {
      host: 'rabbitmq.example.com:5672',
      protocol: 'amqp',
    },
  },
});

// Use with AsyncAPI tooling, documentation, and code generation
```
