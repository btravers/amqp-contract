---
title: Getting Started with amqp-contract - Type-safe AMQP/RabbitMQ for TypeScript
description: Learn how to build type-safe AMQP messaging applications with amqp-contract. Step-by-step guide for Node.js and NestJS developers using TypeScript and RabbitMQ.
---

# Getting Started

Welcome to **amqp-contract**! This guide will help you build type-safe AMQP messaging in minutes.

## What is amqp-contract?

amqp-contract brings end-to-end type safety to [AMQP](https://www.amqp.org/)/[RabbitMQ](https://www.rabbitmq.com/) messaging. Define your contract once, and get automatic validation, type inference, and compile-time checks throughout your application.

## Prerequisites

- Node.js 18 or higher
- [RabbitMQ](https://www.rabbitmq.com/) or another AMQP 0.9.1 broker

## Installation

### Core Packages

Install the essentials:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
pnpm add -D @types/amqplib
```

```bash [npm]
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
npm install -D @types/amqplib
```

```bash [yarn]
yarn add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
yarn add -D @types/amqplib
```

:::

### Optional Packages

#### Testing

For integration testing with RabbitMQ testcontainers:

```bash
pnpm add -D @amqp-contract/testing
```

See the [Testing Guide](/guide/testing) for more details.

#### AsyncAPI Generation

For generating AsyncAPI 3.0 specifications:

```bash
pnpm add @amqp-contract/asyncapi
```

#### NestJS Integration

For [NestJS](https://nestjs.com/) applications:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

```bash [npm]
npm install @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

```bash [yarn]
yarn add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

:::

#### Alternative Schema Libraries

Instead of [Zod](https://zod.dev/), use [Valibot](https://valibot.dev/) or [ArkType](https://arktype.io/):

```bash
# Valibot
pnpm add valibot

# ArkType
pnpm add arktype
```

## RabbitMQ Setup

### Using Docker (Recommended)

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:4-management
```

Access the management UI at `http://localhost:15672` (guest/guest).

### Manual Installation

Follow the [official RabbitMQ installation guide](https://www.rabbitmq.com/docs/download).

## Quick Start

### Step 1: Define Your Contract

Create a contract that defines your AMQP resources and message schemas:

```typescript
// contract.ts
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisherFirst,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// 1. Define resources
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });

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
      }),
    ),
  }),
);

// 3. Publisher-first pattern for event-oriented messaging
const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, { routingKey: "order.created" });

// 4. Create consumer from the event (ensures consistency)
const { consumer: processOrderConsumer, binding: orderBinding } =
  createOrderCreatedConsumer(orderProcessingQueue);

// 5. Compose contract
export const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
  },
  bindings: {
    orderBinding,
  },
  publishers: {
    orderCreated: orderCreatedPublisher,
  },
  consumers: {
    processOrder: processOrderConsumer,
  },
});
```

### Step 2: Publish Messages

Use the type-safe client to publish messages:

```typescript
// publisher.ts
import { TypedAmqpClient } from "@amqp-contract/client";
import { contract } from "./contract";

async function main() {
  const client = await TypedAmqpClient.create({
    contract,
    urls: ["amqp://localhost"],
  }).resultToPromise();

  const result = await client
    .publish("orderCreated", {
      orderId: "ORD-123",
      customerId: "CUST-456",
      amount: 99.99,
      items: [
        { productId: "PROD-A", quantity: 2 },
        { productId: "PROD-B", quantity: 1 },
      ],
    })
    .resultToPromise();

  result.match({
    Ok: () => console.log("✅ Order published!"),
    Error: (error) => console.error("❌ Failed:", error.message),
  });

  await client.close();
}

main();
```

### Step 3: Consume Messages

Create a worker with type-safe message handlers:

```typescript
// consumer.ts
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract";

async function main() {
  const worker = await TypedAmqpWorker.create({
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
    urls: ["amqp://localhost"],
  }).resultToPromise();

  console.log("✅ Worker ready, waiting for messages...");
}

main();
```

## Key Benefits

- ✅ **Type Safety** - Full TypeScript inference from contract to handlers
- ✅ **Auto Validation** - [Zod](https://zod.dev/) validates messages at publish and consume time
- ✅ **Compile Checks** - TypeScript catches errors before runtime
- ✅ **Better DX** - Autocomplete, refactoring, inline docs
- ✅ **Explicit Errors** - Result types for predictable error handling

## Next Steps

- Learn about [Core Concepts](/guide/core-concepts)
- Explore [Client Usage](/guide/client-usage) and [Worker Usage](/guide/worker-usage)
- Check out [Examples](/examples/)
- For NestJS: See [NestJS Client](/guide/client-nestjs-usage) and [NestJS Worker](/guide/worker-nestjs-usage)
