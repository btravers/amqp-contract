---
title: "Introducing amqp-contract: Type-Safe RabbitMQ/AMQP Messaging for TypeScript"
description: "End-to-end type safety and automatic validation for AMQP messaging with AsyncAPI generation"
date: 2025-12-20
author: Benoit TRAVERS
tags: [typescript, rabbitmq, amqp, type-safety, messaging]
---

# Introducing amqp-contract: Type-Safe RabbitMQ/AMQP Messaging for TypeScript

If you've worked with RabbitMQ or AMQP messaging in TypeScript, you've probably experienced the pain of maintaining type safety across your message publishers and consumers. Today, I'm excited to introduce **amqp-contract** — a library that brings end-to-end type safety to AMQP messaging with automatic validation and AsyncAPI generation.

## The Problem with Traditional AMQP Development

Working with RabbitMQ is powerful for building distributed systems, but the traditional approach has several pain points:

```typescript
// ❌ Traditional approach: No type safety
const channel = await connection.createChannel();

// Publishing - what fields? what types?
channel.publish(
  'orders',
  'order.created',
  Buffer.from(JSON.stringify({
    orderId: 'ORD-123',
    amount: 99.99
  }))
);

// Consuming - message type is unknown
channel.consume('order-processing', (msg) => {
  if (msg) {
    const data = JSON.parse(msg.content.toString()); // any type
    console.log(data.orderId); // No autocomplete, no validation
    // What if someone sends the wrong data?
  }
});
```

**Problems:**

- 🚫 No type safety between publishers and consumers
- 🚫 Manual validation required everywhere
- 🚫 Runtime errors from wrong data structures
- 🚫 No autocomplete or IntelliSense
- 🚫 Difficult to maintain consistency across services
- 🚫 Message schema scattered across codebase

## Introducing amqp-contract

**amqp-contract** solves these problems with a contract-first approach. You define your AMQP resources and message schemas once using [Standard Schema](https://github.com/standard-schema/standard-schema) compliant libraries (Zod, Valibot, or ArkType), and type safety flows throughout your application.

### Key Features

✅ **End-to-end type safety** — Full TypeScript inference from contract to client and worker  
✅ **Automatic validation** — Schema validation at all network boundaries  
✅ **Compile-time checks** — Catch errors before runtime  
✅ **AsyncAPI generation** — Generate AsyncAPI 3.0 specifications automatically  
✅ **Better DX** — Full autocomplete, inline documentation, and refactoring support  
✅ **Flexible schemas** — Use Zod, Valibot, or ArkType

## How It Works

### Step 1: Define Your Contract

First, define your AMQP topology and message schemas in one place:

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineBinding,
  definePublisher,
  defineConsumer,
} from '@amqp-contract/contract';
import { z } from 'zod';

// Define contract once with full type safety
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

### Step 2: Type-Safe Publishing

Use the typed client to publish messages with full type safety:

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { orderContract } from './contract';

async function publishOrder() {
  const connection = await connect('amqp://localhost');
  const client = await TypedAmqpClient.create({
    contract: orderContract,
    connection,
  });

  // ✅ Fully typed! TypeScript knows exactly what fields are required
  await client.publish('orderCreated', {
    orderId: 'ORD-123',
    customerId: 'CUST-456',
    amount: 99.99,
    items: [
      { productId: 'PROD-A', quantity: 2 },
      { productId: 'PROD-B', quantity: 1 },
    ],
  });

  // ❌ TypeScript error: Type 'string' is not assignable to type 'number'
  // await client.publish('orderCreated', {
  //   orderId: 'ORD-123',
  //   customerId: 'CUST-456',
  //   amount: 'invalid', // Error caught at compile time!
  // });

  console.log('Order published with validation!');
  await client.close();
  await connection.close();
}
```

The client automatically:

- ✅ Validates the message against the schema
- ✅ Serializes to JSON and Buffer
- ✅ Publishes to the correct exchange with routing key
- ✅ Provides full autocomplete in your IDE

### Step 3: Type-Safe Consuming

Create workers with fully typed message handlers:

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { orderContract } from './contract';

async function startWorker() {
  const connection = await connect('amqp://localhost');

  const worker = await TypedAmqpWorker.create({
    contract: orderContract,
    handlers: {
      processOrder: async (message) => {
        // ✅ message is fully typed!
        // TypeScript knows: message.orderId is string
        // TypeScript knows: message.amount is number
        // TypeScript knows: message.items is an array

        console.log(`Processing order: ${message.orderId}`);
        console.log(`Customer: ${message.customerId}`);
        console.log(`Total: $${message.amount}`);

        for (const item of message.items) {
          console.log(`  - Product ${item.productId}: ${item.quantity}x`);
          // Full autocomplete available!
        }

        // Your business logic here...
      },
    },
    connection,
  });

  console.log('Worker started, waiting for messages...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    await connection.close();
    process.exit(0);
  });
}
```

The worker automatically:

- ✅ Sets up queues, exchanges, and bindings
- ✅ Validates incoming messages
- ✅ Provides typed message handlers
- ✅ Handles acknowledgments

## AsyncAPI Generation

One of the most powerful features is automatic AsyncAPI 3.0 generation. Document your API without writing a single line of YAML:

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
import { orderContract } from './contract';
import { writeFileSync } from 'node:fs';

const spec = generateAsyncAPI(orderContract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
    description: 'API for processing customer orders',
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

// Save AsyncAPI spec
writeFileSync('asyncapi.json', JSON.stringify(spec, null, 2));
```

This generates a complete AsyncAPI specification that you can use with:

- **AsyncAPI Studio** for interactive documentation
- **AsyncAPI Generator** for code generation
- **Microcks** for API mocking and testing
- Any other AsyncAPI-compatible tooling

## Multiple Schema Library Support

While the examples above use Zod, **amqp-contract** supports any [Standard Schema](https://github.com/standard-schema/standard-schema) v1 compliant library:

### Zod

```typescript
import { z } from 'zod';

const schema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
});
```

### Valibot

```typescript
import * as v from 'valibot';

const schema = v.object({
  orderId: v.string(),
  amount: v.pipe(v.number(), v.minValue(0)),
});
```

### ArkType

```typescript
import { type } from 'arktype';

const schema = type({
  orderId: 'string',
  amount: 'number>0',
});
```

All three work seamlessly with amqp-contract!

## Real-World Benefits

After using amqp-contract in production, here are the benefits we've seen:

### 1. **Catch Errors at Compile Time**

```typescript
// ❌ TypeScript error caught immediately
await client.publish('orderCreated', {
  orderId: 123, // Error: Type 'number' is not assignable to 'string'
  amount: 99.99,
});
```

### 2. **Refactor with Confidence**

Change your message schema once, and TypeScript guides you to update all publishers and consumers. No more runtime surprises!

### 3. **Better Onboarding**

New developers can see exactly what messages are available and what fields they require just by looking at the contract and using IDE autocomplete.

### 4. **Automatic Documentation**

AsyncAPI generation means your documentation is always in sync with your code.

### 5. **Reduced Bugs**

Validation at network boundaries catches invalid data before it reaches your business logic.

## Monorepo Architecture

amqp-contract is built as a modular monorepo with separate packages:

| Package                   | Description                                |
| ------------------------- | ------------------------------------------ |
| `@amqp-contract/contract` | Core contract builder and type definitions |
| `@amqp-contract/client`   | Type-safe client for publishing messages   |
| `@amqp-contract/worker`   | Type-safe worker for consuming messages    |
| `@amqp-contract/asyncapi` | AsyncAPI 3.0 specification generator       |
| `@amqp-contract/zod`      | Zod integration utilities                  |
| `@amqp-contract/valibot`  | Valibot integration utilities              |
| `@amqp-contract/arktype`  | ArkType integration utilities              |

Install only what you need:

```bash
# Just the contract and client
pnpm add @amqp-contract/contract @amqp-contract/client

# Add worker for consuming
pnpm add @amqp-contract/worker

# Add AsyncAPI generation
pnpm add @amqp-contract/asyncapi
```

## Getting Started

Ready to try amqp-contract? Here's how to get started:

### Installation

```bash
# Using pnpm (recommended)
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
pnpm add amqplib zod

# Using npm
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
npm install amqplib zod

# Using yarn
yarn add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
yarn add amqplib zod
```

### Quick Start

1. **Define your contract** in `contract.ts`
2. **Create a publisher** using `TypedAmqpClient`
3. **Create a consumer** using `TypedAmqpWorker`
4. **Enjoy type safety!**

Check out our [Getting Started Guide](https://btravers.github.io/amqp-contract/guide/getting-started) for detailed instructions.

## Examples

The repository includes several complete examples:

- **[Basic Order Processing](https://github.com/btravers/amqp-contract/tree/main/samples/basic-order-processing-contract)** - Simple order processing system
- **[AsyncAPI Generation](https://github.com/btravers/amqp-contract/tree/main/samples/asyncapi-generation)** - Generate AsyncAPI specs

Each example is a working application you can run locally.

## Comparison with Other Solutions

### vs. Plain amqplib

- ✅ Type safety
- ✅ Automatic validation
- ✅ Better DX with autocomplete
- ✅ AsyncAPI generation

### vs. Manual Type Definitions

- ✅ Single source of truth
- ✅ Automatic validation
- ✅ Less boilerplate
- ✅ Guaranteed consistency

### vs. Other Messaging Libraries

- ✅ Designed specifically for AMQP/RabbitMQ
- ✅ Contract-first approach
- ✅ Standard Schema support
- ✅ AsyncAPI generation included

## What's Next?

We have exciting plans for amqp-contract:

- 🎯 Support for more Standard Schema libraries
- 🎯 Enhanced AsyncAPI features
- 🎯 CLI tools for contract validation
- 🎯 Code generation from AsyncAPI specs
- 🎯 RabbitMQ management integration
- 🎯 Testing utilities for contract validation

## Contributing

amqp-contract is open source and we welcome contributions! Whether it's:

- 🐛 Bug reports
- 💡 Feature requests
- 📝 Documentation improvements
- 🔧 Code contributions

Check out our [Contributing Guide](https://github.com/btravers/amqp-contract/blob/main/CONTRIBUTING.md) to get started.

## Resources

- **Documentation**: [https://btravers.github.io/amqp-contract](https://btravers.github.io/amqp-contract)
- **GitHub**: [https://github.com/btravers/amqp-contract](https://github.com/btravers/amqp-contract)
- **npm**: [@amqp-contract/contract](https://www.npmjs.com/package/@amqp-contract/contract)
- **Examples**: [Sample Projects](https://github.com/btravers/amqp-contract/tree/main/samples)

## Conclusion

If you're building TypeScript applications with RabbitMQ or AMQP, **amqp-contract** can dramatically improve your development experience. By bringing type safety to messaging, it catches errors at compile time, makes refactoring safer, and provides excellent developer experience with autocomplete and inline documentation.

The contract-first approach ensures consistency across your distributed system, while AsyncAPI generation keeps your documentation in sync with your code.

Give it a try and let us know what you think! We'd love to hear your feedback and use cases.

---

**Try amqp-contract today:**

```bash
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
```

Happy messaging! 🐰📨
