---
layout: home
title: amqp-contract - Type-safe AMQP/RabbitMQ messaging for TypeScript and Node.js
description: Build reliable message-driven applications with end-to-end type safety, automatic schema validation, reliable retry patterns, and AsyncAPI generation for AMQP/RabbitMQ in TypeScript, Node.js, and NestJS

hero:
  name: "amqp-contract"
  text: "Type-safe contracts for AMQP/RabbitMQ"
  tagline: Type safety & validation · Reliable retry patterns · AsyncAPI compatibility
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
    title: Type Safety, Autocompletion & Validation
    details: End-to-end TypeScript inference with runtime schema validation using <a href="https://zod.dev/" target="_blank" rel="noopener noreferrer">Zod</a>, <a href="https://valibot.dev/" target="_blank" rel="noopener noreferrer">Valibot</a>, or <a href="https://arktype.io/" target="_blank" rel="noopener noreferrer">ArkType</a>. Full IntelliSense support and compile-time error checking.

  - icon: 🔄
    title: Reliable Retry Pattern with RabbitMQ
    details: Built-in retry with exponential backoff using RabbitMQ's native TTL and Dead Letter Exchange (DLX). Configurable delays, jitter, and automatic DLQ routing after max retries.

  - icon: 📄
    title: AsyncAPI Compatibility
    details: Generate AsyncAPI 3.0 specifications from contracts. Unlock the <a href="https://www.asyncapi.com/" target="_blank" rel="noopener noreferrer">AsyncAPI</a> ecosystem — contract visualization, breaking change detection, validation, and documentation generation.

  - icon: 🎯
    title: NestJS Integration
    details: First-class <a href="https://nestjs.com/" target="_blank" rel="noopener noreferrer">NestJS</a> support with automatic lifecycle management and dependency injection.

  - icon: 📝
    title: Contract-First Design
    details: Define your AMQP interface once with schemas — types, validation, and retry behavior flow from there.

  - icon: 🔌
    title: Framework Agnostic
    details: Use with any framework or none at all. Core packages work anywhere TypeScript runs.
---

## Three Core Features

### 🔒 Type Safety, Autocompletion & Runtime Validation

Define your AMQP contracts once with schema validation — get **end-to-end type safety**, **IntelliSense autocompletion**, and **automatic runtime validation** everywhere:

::: code-group

```typescript [Type-Safe Publishing]
import { TypedAmqpClient } from "@amqp-contract/client";
import { defineMessage } from "@amqp-contract/contract";
import { contract } from "./contract"; // Your contract definition
import { z } from "zod";

// Publishing: TypeScript knows the exact shape
const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
}).resultToPromise();

await client.publish("orderCreated", {
  orderId: "ORD-123", // ✅ Autocomplete & type checking
  amount: 99.99, // ✅ Runtime validation
  // ✅ Missing fields caught at compile time!
});
```

```typescript [Type-Safe Consuming]
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract"; // Your contract definition

// Consuming: Fully typed message handlers
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId); // ✅ TypeScript knows the type!
      console.log(message.amount); // ✅ Full autocomplete!
      // ✅ Automatic validation - invalid messages rejected!
    },
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

:::

**Benefits:**

- ✅ **TypeScript type inference** from contract to client and worker
- ✅ **Compile-time checks** catch errors before deployment
- ✅ **Schema validation** with [Zod](https://zod.dev/), [Valibot](https://valibot.dev/), or [ArkType](https://arktype.io/)
- ✅ **IntelliSense autocomplete** and inline documentation

---

### 🔄 Reliable Retry Pattern with RabbitMQ

Built-in **retry with exponential backoff** using RabbitMQ's native TTL and Dead Letter Exchange (DLX) pattern:

```typescript
import { TypedAmqpWorker, RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { contract } from "./contract"; // Your contract definition

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      try {
        await processPayment(message); // If this fails, message is retried
      } catch (error) {
        if (isValidationError(error)) {
          throw new NonRetryableError("Invalid data"); // Goes directly to DLQ
        }
        throw new RetryableError("Transient failure"); // Retried with backoff
      }
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3, // Retry up to 3 times
    initialDelayMs: 1000, // Start with 1 second delay
    maxDelayMs: 30000, // Max 30 seconds between retries
    backoffMultiplier: 2, // Double delay each retry (1s → 2s → 4s)
    jitter: true, // Randomize to prevent thundering herd
  },
}).resultToPromise();

// Helper functions (implement based on your needs)
function processPayment(message: unknown) {
  /* ... */
}
function isValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === "ValidationError";
}
```

**How it works:**

1. Failed messages are routed to a **wait queue** with TTL
2. After TTL expires, messages are automatically **dead-lettered back** for retry
3. Delays increase **exponentially** (1s → 2s → 4s → 8s...)
4. After max retries, messages go to the **Dead Letter Queue** for inspection

**Benefits:**

- ✅ **Automatic retry** with configurable exponential backoff
- ✅ **Jitter support** to prevent thundering herd problems
- ✅ **Dead Letter Queue** routing after max retries exceeded
- ✅ **Retry headers** tracking (retry count, last error, first failure timestamp)
- ✅ **RetryableError vs NonRetryableError** for explicit control

---

### 📄 AsyncAPI Compatibility

Generate **AsyncAPI 3.0 specifications** from your contracts — unlock the entire [AsyncAPI](https://www.asyncapi.com/) ecosystem of tools:

```typescript
import { writeFileSync } from "fs";
import { AsyncAPIGenerator } from "@amqp-contract/asyncapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { contract } from "./contract"; // Your contract definition

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

// Export as JSON or YAML
writeFileSync("asyncapi.json", JSON.stringify(spec, null, 2));
```

**What you can do with AsyncAPI:**

| Tool                                            | Purpose                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| [AsyncAPI Studio](https://studio.asyncapi.com/) | 📊 **Visualize** your contracts interactively    |
| `asyncapi diff`                                 | 🔍 **Detect breaking changes** before deployment |
| `asyncapi validate`                             | ✅ **Validate** your specifications              |
| `asyncapi generate`                             | 📝 **Generate** HTML documentation               |

```bash
# Install AsyncAPI CLI
npm install -g @asyncapi/cli

# Validate your contract
asyncapi validate asyncapi.json

# Generate HTML documentation
asyncapi generate fromFile asyncapi.json @asyncapi/html-template -o docs/

# Detect breaking changes
asyncapi diff old-asyncapi.json new-asyncapi.json
```

---

## Who Should Use This?

### 🎯 Perfect for:

- **Backend TypeScript Developers** using RabbitMQ who want type safety and validation
- **NestJS Developers** building microservices with message-based communication
- **Platform Teams** enforcing message contracts across multiple services
- **Teams** collaborating on event-driven architectures with shared schemas
- **Developers** who need reliable retry patterns without reinventing the wheel

### ⚡ Quick Stats

[![npm version](https://img.shields.io/npm/v/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![GitHub stars](https://img.shields.io/github/stars/btravers/amqp-contract.svg)](https://github.com/btravers/amqp-contract)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Battle-tested in production** • **8 packages** • **Full TypeScript support**

<div style="text-align: center; margin: 2rem 0;">
  <img src="https://img.shields.io/badge/TypeScript-Full%20Support-blue?logo=typescript" alt="TypeScript" style="margin: 0 0.5rem;">
  <img src="https://img.shields.io/badge/RabbitMQ-Compatible-orange?logo=rabbitmq" alt="RabbitMQ" style="margin: 0 0.5rem;">
  <img src="https://img.shields.io/badge/NestJS-First--class-red?logo=nestjs" alt="NestJS" style="margin: 0 0.5rem;">
  <img src="https://img.shields.io/badge/AsyncAPI-3.0-green" alt="AsyncAPI" style="margin: 0 0.5rem;">
</div>

---

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

// Define resources with Dead Letter Exchange for retry support
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: { exchange: ordersDlx, routingKey: "order.failed" },
});

// Define message with schema validation
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
  exchanges: { orders: ordersExchange, ordersDlx },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: { orderBinding },
  publishers: { orderCreated: orderCreatedPublisher },
  consumers: { processOrder: processOrderConsumer },
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

```typescript [3. Consume with Retry]
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
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
}).resultToPromise();
```

:::

---

## NestJS Integration

First-class [NestJS](https://nestjs.com/) support with automatic lifecycle management:

```typescript
import { Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { contract } from "./contract";

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log("Processing:", message.orderId);
        },
      },
      urls: ["amqp://localhost"],
      retry: { maxRetries: 3, initialDelayMs: 1000 },
    }),
    AmqpClientModule.forRoot({
      contract,
      urls: ["amqp://localhost"],
    }),
  ],
})
export class AppModule {}
```

📖 **[NestJS Documentation →](/guide/client-nestjs-usage)**

---

## Inspiration

This project was inspired by the contract-first approach of [tRPC](https://trpc.io/), [oRPC](https://orpc.dev/), and [ts-rest](https://ts-rest.com/). We've adapted their excellent ideas of end-to-end type safety and schema-driven development to the world of [RabbitMQ](https://www.rabbitmq.com/) and AMQP messaging.
