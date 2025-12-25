---
title: Building Type-Safe AMQP Messaging with amqp-contract
published: false
description: Discover how amqp-contract brings end-to-end type safety, automatic validation, and AsyncAPI generation to RabbitMQ and AMQP messaging in TypeScript applications
tags: typescript, rabbitmq, microservices, opensource
cover_image: https://raw.githubusercontent.com/btravers/amqp-contract/main/website/docs/public/logo.svg
canonical_url: https://btravers.github.io/amqp-contract/blog/introducing-amqp-contract
---

# Building Type-Safe AMQP Messaging with amqp-contract

If you've worked with [RabbitMQ](https://www.rabbitmq.com/) or AMQP messaging in TypeScript, you've probably experienced the frustration of dealing with untyped messages, scattered validation logic, and the constant fear of runtime errors from mismatched data structures. What if there was a better way?

Today, I'm excited to introduce [**amqp-contract**](https://github.com/btravers/amqp-contract) — a TypeScript library that brings the power of contract-first development, end-to-end type safety, and automatic validation to AMQP messaging.

## The Problem with Traditional AMQP Development

Let's start with a typical scenario. You're building a microservices architecture using RabbitMQ for inter-service communication. Your publisher looks something like this:

```typescript
// ❌ Traditional approach - no type safety
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://localhost');
const channel = await connection.createChannel();

await channel.assertExchange('orders', 'topic', { durable: true });

// What fields should this have? What types?
channel.publish(
  'orders',
  'order.created',
  Buffer.from(JSON.stringify({
    orderId: 'ORD-123',
    amount: 99.99,
    // Did I forget any required fields?
  }))
);
```

And your consumer:

```typescript
// ❌ No type information
channel.consume('order-processing', (msg) => {
  const data = JSON.parse(msg.content.toString()); // unknown type
  console.log(data.orderId); // No autocomplete, no validation
  // Is this the right field name? Who knows!
});
```

This approach has several critical issues:

1. **No Type Safety**: You lose all TypeScript benefits at the messaging boundary
2. **Manual Validation**: You need to manually validate every message, or risk runtime errors
3. **Scattered Definitions**: Message structures are defined implicitly or scattered across your codebase
4. **Refactoring Nightmares**: Change a field name? Good luck finding all the places it's used
5. **Documentation Drift**: Your code and documentation quickly get out of sync

## Enter amqp-contract

**amqp-contract** solves these problems by bringing a contract-first approach to AMQP messaging. Inspired by the excellent [tRPC](https://trpc.io/), [oRPC](https://orpc.dev/), and [ts-rest](https://ts-rest.com/) libraries, it adapts their philosophy of end-to-end type safety to the world of message queues.

Here's what the same code looks like with amqp-contract:

### 1. Define Your Contract

First, define your contract with full type safety using schema validation libraries like [Zod](https://zod.dev/), [Valibot](https://valibot.dev/), or [ArkType](https://arktype.io/):

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
  defineMessage,
  defineQueueBinding,
} from '@amqp-contract/contract';
import { z } from 'zod';

// Define your AMQP resources
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

// Define your message schema
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    ),
    totalAmount: z.number().positive(),
    status: z.enum(['pending', 'processing', 'completed']),
  })
);

// Compose your contract
export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: {
    orderBinding: defineQueueBinding(
      orderProcessingQueue,
      ordersExchange,
      { routingKey: 'order.created' }
    ),
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
```

### 2. Type-Safe Publishing

Now use the contract to create a type-safe client:

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
});

if (clientResult.isError()) {
  throw clientResult.error;
}

const client = clientResult.get();

// ✅ Fully typed! TypeScript knows exactly what fields are required
const result = await client.publish('orderCreated', {
  orderId: 'ORD-123',
  customerId: 'CUST-456',
  items: [
    { productId: 'PROD-789', quantity: 2, price: 49.99 }
  ],
  totalAmount: 99.98,
  status: 'pending',
});

result.match({
  Ok: () => console.log('✅ Published'),
  Error: (error) => console.error('❌ Failed:', error),
});
```

### 3. Type-Safe Consuming

And create a type-safe worker for consuming messages:

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    // ✅ message is fully typed based on your schema
    processOrder: async (message) => {
      console.log(`Processing order: ${message.orderId}`);
      console.log(`Customer: ${message.customerId}`);
      console.log(`Total: $${message.totalAmount}`);

      // ✅ Full autocomplete for all fields
      message.items.forEach((item) => {
        console.log(`- ${item.quantity}x Product ${item.productId}`);
      });
    },
  },
  urls: ['amqp://localhost'],
});

workerResult.match({
  Ok: (worker) => console.log('✅ Worker ready'),
  Error: (error) => { throw error; },
});
```

## Key Features That Make amqp-contract Special

### 🔒 End-to-End Type Safety

TypeScript types flow automatically from your contract to publishers and consumers. No manual type annotations needed. If you refactor your schema, TypeScript immediately shows you every place that needs updating.

### ✅ Automatic Validation

Messages are automatically validated at network boundaries using [Standard Schema v1](https://github.com/standard-schema/standard-schema). This works with Zod, Valibot, and ArkType, giving you the flexibility to choose your preferred validation library.

### 🛠️ Compile-Time Checks

TypeScript catches errors before runtime:

```typescript
// ❌ TypeScript error - "orderDeleted" doesn't exist
await client.publish('orderDeleted', { orderId: '123' });

// ❌ TypeScript error - missing handler
await TypedAmqpWorker.create({
  contract,
  handlers: {}, // forgot processOrder!
  urls: ['amqp://localhost'],
});
```

### 📄 AsyncAPI 3.0 Generation

Automatically generate [AsyncAPI](https://www.asyncapi.com/) specifications from your contracts:

```typescript
import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';

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

### 🎯 First-Class NestJS Support

If you're using [NestJS](https://nestjs.com/), amqp-contract provides dedicated integration packages:

```typescript
import { Module } from '@nestjs/common';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing:', message.orderId);
        },
      },
      connection: process.env.RABBITMQ_URL,
    }),
    AmqpClientModule.forRoot({
      contract,
      connection: process.env.RABBITMQ_URL,
    }),
  ],
})
export class AppModule {}
```

## Why Choose amqp-contract?

### Compared to Raw amqplib

- ✅ Type safety vs ❌ No types
- ✅ Automatic validation vs ❌ Manual validation
- ✅ Compile-time checks vs ❌ Runtime errors
- ✅ Refactoring support vs ❌ Find/replace
- ✅ Documentation from code vs ❌ Manual docs

### Compared to Other Solutions

Unlike other AMQP libraries, amqp-contract:

- Focuses on **type safety first** — types are derived from your contract
- Uses **Standard Schema v1** — compatible with multiple validation libraries
- Generates **AsyncAPI specs** — automatic documentation
- Provides **explicit error handling** — uses Result types
- Is **framework agnostic** — works standalone or with NestJS

## Getting Started

### Installation

```bash
# Core packages
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker

# Choose your schema library
pnpm add zod  # or valibot, or arktype

# AMQP client
pnpm add amqplib @types/amqplib
```

### Quick Start

1. **Define your contract** with schemas
2. **Create a client** to publish messages
3. **Create a worker** to consume messages
4. **Enjoy type safety** end-to-end!

## Try It Today!

amqp-contract is [open source](https://github.com/btravers/amqp-contract) (MIT license) and available on npm:

- 📦 [npm package](https://www.npmjs.com/package/@amqp-contract/contract)
- 📖 [Documentation](https://btravers.github.io/amqp-contract)
- 💻 [GitHub repository](https://github.com/btravers/amqp-contract)
- 🌟 [Star on GitHub](https://github.com/btravers/amqp-contract)

Check out the [full documentation](https://btravers.github.io/amqp-contract) for detailed guides, API reference, and examples.

## Conclusion

Type safety shouldn't stop at your application boundaries. With amqp-contract, you can bring the same level of type safety and developer experience you enjoy with TypeScript to your AMQP messaging layer.

Stop fighting runtime errors. Stop manually validating messages. Stop worrying about refactoring. Start building type-safe, validated, and maintainable messaging systems today.

---

**What do you think?** Have you tried amqp-contract? What are your experiences with type-safe messaging? Let me know in the comments!
