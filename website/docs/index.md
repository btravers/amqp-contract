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
      text: Why amqp-contract?
      link: /guide/why-amqp-contract
    - theme: alt
      text: View on GitHub
      link: https://github.com/btravers/amqp-contract

features:
  - icon: 🔒
    title: End-to-end Type Safety
    details: Full TypeScript inference from contract to client and worker. No manual type annotations needed.
  
  - icon: ✅
    title: Automatic Validation
    details: Schema validation at network boundaries with <a href="https://zod.dev/" target="_blank" rel="noopener noreferrer">Zod</a>, <a href="https://valibot.dev/" target="_blank" rel="noopener noreferrer">Valibot</a>, or <a href="https://arktype.io/" target="_blank" rel="noopener noreferrer">ArkType</a>. No runtime surprises.
  
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
    details: First-class <a href="https://nestjs.com/" target="_blank" rel="noopener noreferrer">NestJS</a> support with automatic lifecycle management and dependency injection.

  - icon: 🔌
    title: Framework Agnostic
    details: Use with any framework or none at all. Core packages work anywhere TypeScript runs.
---

## The Problem

Working with [RabbitMQ](https://www.rabbitmq.com/)/AMQP messaging is powerful, but comes with challenges:

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
import { defineContract, defineExchange, defineQueue, definePublisher, defineConsumer, defineMessage, defineQueueBinding } from '@amqp-contract/contract';
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { z } from 'zod';

// 1. Define resources
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

// 2. Define message
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
  })
);

// 3. Compose contract
const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
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
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});

// 4. Type-safe client with explicit error handling
const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost']
});

if (clientResult.isError()) {
  throw clientResult.error; // Handle connection error
}

const client = clientResult.get();

const result = await client.publish('orderCreated', {
  orderId: 'ORD-123',      // ✅ TypeScript knows!
  customerId: 'CUST-456',
  amount: 99.99,
});

result.match({
  Ok: () => console.log('Published'),
  Error: (error) => console.error('Failed:', error),
});

// 5. Type-safe worker
const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId);  // ✅ Fully typed!
    },
  },
  urls: ['amqp://localhost'],
});

workerResult.match({
  Ok: (worker) => console.log('Worker ready'),
  Error: (error) => {
    throw error;
  },
});

const worker = workerResult.value;
```

## Quick Start

Get up and running in three simple steps:

::: code-group

```typescript [1. Define Contract]
import { defineContract, defineExchange, defineQueue, definePublisher, defineConsumer, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

// Define resources
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

// Define message
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  })
);

// Compose contract
export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});
```

```typescript [2. Publish Messages]
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost']
});

if (clientResult.isError()) {
  throw clientResult.error; // Handle connection error
}

const client = clientResult.get();

const result = await client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

result.match({
  Ok: () => console.log('✅ Published'),
  Error: (error) => console.error('❌ Failed:', error),
});
```

```typescript [3. Consume Messages]
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(`Processing: ${message.orderId}`);
      console.log(`Amount: $${message.amount}`);
    },
  },
  urls: ['amqp://localhost'],
});

workerResult.match({
  Ok: (worker) => console.log('✅ Worker ready'),
  Error: (error) => {
    throw error;
  },
});
```

:::

## AsyncAPI Generation

Automatically generate AsyncAPI 3.0 specifications from your contracts:

```typescript
import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { contract } from './contract';

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
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
```

📖 **[Learn more about AsyncAPI Generation →](/guide/asyncapi-generation)**

## Inspiration

This project was inspired by the contract-first approach of [tRPC](https://trpc.io/), [oRPC](https://orpc.dev/), and [ts-rest](https://ts-rest.com/). We've adapted their excellent ideas of end-to-end type safety and schema-driven development to the world of [RabbitMQ](https://www.rabbitmq.com/) and AMQP messaging.
