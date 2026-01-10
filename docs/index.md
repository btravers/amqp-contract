---
layout: home
title: amqp-contract - Type-safe AMQP/RabbitMQ messaging for TypeScript and Node.js
description: Build reliable message-driven applications with end-to-end type safety, automatic schema validation, and AsyncAPI generation for AMQP/RabbitMQ in TypeScript, Node.js, and NestJS

hero:
  name: "amqp-contract"
  text: "Type-safe contracts for AMQP/RabbitMQ"
  tagline: End-to-end type safety and automatic validation for AMQP messaging with AsyncAPI generation for TypeScript, Node.js, and NestJS applications
  image:
    src: /logo.svg
    alt: amqp-contract
  actions:
    - theme: brand
      text: Quick Start (5 min)
      link: /guide/quick-start
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

## Why Choose amqp-contract?

Stop fighting with untyped AMQP code. Get type safety, validation, and great developer experience out of the box.

::: code-group

```typescript [❌ Without amqp-contract]
// Verbose, error-prone, no type safety
import * as amqp from "amqplib";

const connection = await amqp.connect("amqp://localhost");
const channel = await connection.createChannel();

await channel.assertExchange("orders", "topic", { durable: true });
await channel.assertQueue("order-processing", { durable: true });
await channel.bindQueue("order-processing", "orders", "order.created");

// ❌ No type checking!
// ❌ No validation!
// ❌ Manual error handling!
channel.publish(
  "orders",
  "order.created",
  Buffer.from(
    JSON.stringify({
      orderId: "ORD-123",
      amount: "99.99", // ❌ Should be number - no error until runtime!
      // ❌ Missing required fields - no compile-time error!
    }),
  ),
);

// Consumer - manually parse and validate
channel.consume("order-processing", (msg) => {
  if (msg) {
    const data = JSON.parse(msg.content.toString()); // ❌ Any type!
    console.log(data.orderId); // ❌ No autocomplete!
    // ❌ No validation - runtime errors waiting to happen!
    channel.ack(msg);
  }
});
```

```typescript [✅ With amqp-contract]
// Type-safe, validated, clean
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
  defineMessage,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { TypedAmqpClient } from "@amqp-contract/client";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { z } from "zod";

// Define once, use everywhere
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(), // ✅ Type enforced!
  }),
);

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});

// Publisher - fully typed!
const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
}).resultToPromise();

const result = await client.publish("orderCreated", {
  orderId: "ORD-123",
  amount: 99.99, // ✅ Number required - TypeScript enforces!
  // ✅ Missing fields caught at compile time!
});

result.match({
  Ok: () => console.log("✅ Published"),
  Error: (error) => console.error("❌ Failed:", error),
}); // ✅ Automatic validation!

// Consumer - fully typed!
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId); // ✅ Full autocomplete!
      console.log(message.amount); // ✅ Known to be number!
      // ✅ Automatic validation - invalid messages rejected!
    }, // ✅ Auto-acknowledgment on success!
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

:::

## Who Should Use This?

### 🎯 Perfect for:

- **Backend TypeScript Developers** using RabbitMQ who want type safety and validation
- **NestJS Developers** building microservices with message-based communication
- **Platform Teams** enforcing message contracts across multiple services
- **Teams** collaborating on event-driven architectures with shared schemas
- **Developers** who value great DX with autocomplete and refactoring support

### ⚡ Quick Stats

[![npm version](https://img.shields.io/npm/v/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![GitHub stars](https://img.shields.io/github/stars/btravers/amqp-contract.svg)](https://github.com/btravers/amqp-contract)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Battle-tested in production** • **8 packages** • **Full TypeScript support**

## See It in Action

Experience the power of type-safe messaging:

- **IntelliSense Autocomplete** - Your IDE knows all message fields and types
- **Compile-Time Errors** - Catch mistakes before runtime
- **Refactoring Support** - Rename fields safely across your entire codebase
- **Inline Documentation** - Hover over fields to see schemas and descriptions

<div style="text-align: center; margin: 2rem 0;">
  <img src="https://img.shields.io/badge/TypeScript-Full%20Support-blue?logo=typescript" alt="TypeScript" style="margin: 0 0.5rem;">
  <img src="https://img.shields.io/badge/RabbitMQ-Compatible-orange?logo=rabbitmq" alt="RabbitMQ" style="margin: 0 0.5rem;">
  <img src="https://img.shields.io/badge/NestJS-First--class-red?logo=nestjs" alt="NestJS" style="margin: 0 0.5rem;">
  <img src="https://img.shields.io/badge/AsyncAPI-3.0-green" alt="AsyncAPI" style="margin: 0 0.5rem;">
</div>

## Quick Start

Get up and running in three simple steps:

::: code-group

```typescript [1. Define Contract]
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisherFirst,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define resources
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });

// Define message
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

// Publisher-first pattern ensures consistency
const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, { routingKey: "order.created" });

// Create consumer from the event
const { consumer: processOrderConsumer, binding: orderBinding } =
  createOrderCreatedConsumer(orderProcessingQueue);

// Compose contract
export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: { orderBinding },
  publishers: {
    orderCreated: orderCreatedPublisher,
  },
  consumers: {
    processOrder: processOrderConsumer,
  },
});
```

```typescript [2. Publish Messages]
import { TypedAmqpClient } from "@amqp-contract/client";
import { contract } from "./contract";

const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
}).resultToPromise();

const result = await client.publish("orderCreated", {
  orderId: "ORD-123",
  amount: 99.99,
});

result.match({
  Ok: () => console.log("✅ Published"),
  Error: (error) => console.error("❌ Failed:", error),
});
```

```typescript [3. Consume Messages]
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(`Processing: ${message.orderId}`);
      console.log(`Amount: $${message.amount}`);
    },
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

:::

## AsyncAPI Generation

Automatically generate AsyncAPI 3.0 specifications from your contracts:

```typescript
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { contract } from "./contract";

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: {
    title: "Order Processing API",
    version: "1.0.0",
  },
  servers: {
    production: {
      host: "rabbitmq.example.com:5672",
      protocol: "amqp",
    },
  },
});
```

## Inspiration

This project was inspired by the contract-first approach of [tRPC](https://trpc.io/), [oRPC](https://orpc.dev/), and [ts-rest](https://ts-rest.com/). We've adapted their excellent ideas of end-to-end type safety and schema-driven development to the world of [RabbitMQ](https://www.rabbitmq.com/) and AMQP messaging.
