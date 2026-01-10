<div align="center">

# amqp-contract

**Type-safe contracts for [AMQP](https://www.amqp.org/)/[RabbitMQ](https://www.rabbitmq.com/) messaging with [TypeScript](https://www.typescriptlang.org/)**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/contract.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/contract)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**Documentation**](https://btravers.github.io/amqp-contract) · [**Get Started**](https://btravers.github.io/amqp-contract/guide/getting-started) · [**Examples**](https://btravers.github.io/amqp-contract/examples/)

</div>

## Three Core Features

### 🔒 Type Safety, Autocompletion & Runtime Validation

Define your AMQP contracts once with schema validation — get **end-to-end type safety**, **IntelliSense autocompletion**, and **automatic runtime validation** everywhere:

- **TypeScript type inference** from contract to client and worker
- **Compile-time checks** catch errors before deployment
- **Schema validation** with [Zod](https://zod.dev/), [Valibot](https://valibot.dev/), or [ArkType](https://arktype.io/)

```typescript
import { defineMessage } from "@amqp-contract/contract";
import { TypedAmqpClient } from "@amqp-contract/client";
import { TypedAmqpWorker } from "@amqp-contract/worker";
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
});

// Consuming: Fully typed message handlers
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId); // ✅ TypeScript knows the type!
    },
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

### 🔄 Reliable Retry Pattern with RabbitMQ

Built-in **retry with exponential backoff** using RabbitMQ's native TTL and Dead Letter Exchange (DLX) pattern:

- **Automatic retry** with configurable backoff (initial delay, max delay, multiplier)
- **Jitter support** to prevent thundering herd problems
- **Dead Letter Queue** routing after max retries exceeded
- **Retry headers tracking** (retry count, last error, first failure timestamp)

```typescript
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract"; // Your contract definition

// Configure reliable retry with exponential backoff
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Your business logic here - if this fails, message is retried
      await saveToDatabase(message);
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3, // Retry up to 3 times
    initialDelayMs: 1000, // Start with 1 second delay
    maxDelayMs: 30000, // Max 30 seconds between retries
    backoffMultiplier: 2, // Double delay each retry
    jitter: true, // Randomize to prevent thundering herd
  },
}).resultToPromise();
```

**How it works:** Failed messages are routed to a wait queue with TTL, then automatically dead-lettered back for retry. After max retries, messages go to the Dead Letter Queue for manual inspection.

### 📄 AsyncAPI Compatibility

Generate **AsyncAPI 3.0 specifications** from your contracts — unlock the entire [AsyncAPI](https://www.asyncapi.com/) ecosystem of tools:

- **📊 Contract visualization** — [AsyncAPI Studio](https://studio.asyncapi.com/) for interactive API docs
- **🔍 Breaking change detection** — Catch schema changes before deployment
- **✅ Contract validation** — Validate specs with AsyncAPI CLI
- **📝 Documentation generation** — Auto-generate HTML docs from contracts

```typescript
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

// Use AsyncAPI tools
// - asyncapi validate asyncapi.json
// - asyncapi generate fromFile asyncapi.json @asyncapi/html-template -o docs/
```

## Quick Example

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisherFirst,
  defineMessage,
} from "@amqp-contract/contract";
import { TypedAmqpClient } from "@amqp-contract/client";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { z } from "zod";

// 1. Define resources with Dead Letter Exchange for retry support
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: { exchange: ordersDlx, routingKey: "order.failed" },
});

// 2. Define message with schema validation
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

// 3. Publisher-first pattern ensures consistency
const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, { routingKey: "order.created" });

// 4. Create consumer from event
const { consumer: processOrderConsumer, binding: orderBinding } =
  createOrderCreatedConsumer(orderProcessingQueue);

// 5. Define contract
const contract = defineContract({
  exchanges: { orders: ordersExchange, ordersDlx },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: { orderBinding },
  publishers: { orderCreated: orderCreatedPublisher },
  consumers: { processOrder: processOrderConsumer },
});

// 6. Type-safe publishing with validation
const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
}).resultToPromise();

await client.publish("orderCreated", {
  orderId: "ORD-123", // ✅ TypeScript knows!
  amount: 99.99,
});

// 7. Type-safe consuming with reliable retry
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId); // ✅ TypeScript knows!
    },
  },
  urls: ["amqp://localhost"],
  retry: { maxRetries: 3, initialDelayMs: 1000 },
}).resultToPromise();
```

## Installation

```bash
# Core packages
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker

# For NestJS applications
pnpm add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs

# For AsyncAPI generation
pnpm add @amqp-contract/asyncapi
```

## NestJS Integration

First-class [NestJS](https://nestjs.com/) support with dependency injection and automatic lifecycle management:

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
    }),
    AmqpClientModule.forRoot({
      contract,
      urls: ["amqp://localhost"],
    }),
  ],
})
export class AppModule {}
```

📖 **[NestJS Documentation →](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage)**

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

### Guides

- [Getting Started](https://btravers.github.io/amqp-contract/guide/getting-started) — Install and create your first contract
- [Core Concepts](https://btravers.github.io/amqp-contract/guide/core-concepts) — Understand exchanges, queues, and bindings
- [Worker Usage](https://btravers.github.io/amqp-contract/guide/worker-usage) — Error handling and retry patterns
- [AsyncAPI Generation](https://btravers.github.io/amqp-contract/guide/asyncapi-generation) — Generate API specifications
- [API Reference](https://btravers.github.io/amqp-contract/api/) — Complete API documentation
- [Examples](https://btravers.github.io/amqp-contract/examples/) — Real-world usage patterns

### Architecture & Design

- [Architecture Decision Records](docs/adr/README.md) — Design decisions and rationale
- [Terminology Guide](docs/TERMINOLOGY.md) — Client/worker vs publisher/consumer

## Packages

| Package                                                  | Description                           |
| -------------------------------------------------------- | ------------------------------------- |
| [@amqp-contract/contract](./packages/contract)           | Contract builder and type definitions |
| [@amqp-contract/client](./packages/client)               | Type-safe client for publishing       |
| [@amqp-contract/worker](./packages/worker)               | Type-safe worker with retry support   |
| [@amqp-contract/client-nestjs](./packages/client-nestjs) | NestJS client integration             |
| [@amqp-contract/worker-nestjs](./packages/worker-nestjs) | NestJS worker integration             |
| [@amqp-contract/asyncapi](./packages/asyncapi)           | AsyncAPI 3.0 generator                |

## Inspiration

This project was inspired by the contract-first approach of [tRPC](https://trpc.io/), [oRPC](https://orpc.dev/), and [ts-rest](https://ts-rest.com/). We've adapted their excellent ideas of end-to-end type safety and schema-driven development to the world of [RabbitMQ](https://www.rabbitmq.com/) and AMQP messaging.

## Topics

`amqp` · `rabbitmq` · `typescript` · `nodejs` · `nestjs` · `messaging` · `message-queue` · `retry-pattern` · `dead-letter-queue` · `type-safe` · `schema-validation` · `contract-first` · `asyncapi` · `event-driven` · `microservices`

## Contributing

See [CONTRIBUTING.md](https://github.com/btravers/amqp-contract/blob/main/CONTRIBUTING.md).

## License

MIT
