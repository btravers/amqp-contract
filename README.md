<div align="center">

# amqp-contract

**Type-safe contracts for [AMQP](https://www.amqp.org/)/[RabbitMQ](https://www.rabbitmq.com/) messaging with [TypeScript](https://www.typescriptlang.org/)**

Build reliable message-driven applications with end-to-end type safety and automatic schema validation for [Node.js](https://nodejs.org/) and [NestJS](https://nestjs.com/)

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/contract.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/contract)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[**Documentation**](https://btravers.github.io/amqp-contract) · [**Get Started**](https://btravers.github.io/amqp-contract/guide/getting-started) · [**Examples**](https://btravers.github.io/amqp-contract/examples/)

</div>

## Features

- ✅ **End-to-end type safety** — Full TypeScript type inference from contract definition to client and worker implementation
- ✅ **Automatic validation** — Runtime schema validation with [Zod](https://zod.dev/), [Valibot](https://valibot.dev/), or [ArkType](https://arktype.io/)
- ✅ **Compile-time checks** — TypeScript catches missing or incorrect message handler implementations before deployment
- ✅ **NestJS integration** — First-class [NestJS](https://nestjs.com/) support with dependency injection and automatic lifecycle management
- ✅ **AsyncAPI generation** — Generate AsyncAPI 3.0 specifications from contracts for API documentation
- ✅ **Better DX** — IntelliSense autocomplete, safe refactoring, and inline documentation for Node.js development

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

// 1. Define resources
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });

// 2. Define message with schema
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

// 6. Client - type-safe publishing with explicit error handling
const clientResult = await TypedAmqpClient.create({ contract, connection });
if (clientResult.isError()) {
  throw clientResult.error; // or handle error appropriately
}
const client = clientResult.get();

const result = await client.publish("orderCreated", {
  orderId: "ORD-123", // ✅ TypeScript knows!
  amount: 99.99,
});

// Handle errors explicitly using match pattern
result.match({
  Ok: (value) => console.log("Published successfully"),
  Error: (error) => {
    console.error("Failed to publish:", error);
    // error is TechnicalError or MessageValidationError
  },
});

// 7. Worker - type-safe consuming
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(message.orderId); // ✅ TypeScript knows!
    },
  },
  connection,
});
```

> **Note**: If your application both publishes and consumes messages, see the [Architecture Review](docs/review/2025-12-25-architecture-review.md#3-connection-sharing-analysis) for connection sharing strategies to optimize resource usage.

## Installation

```bash
# Core packages
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker

# For NestJS applications
pnpm add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

## NestJS Integration

Use the dedicated [NestJS](https://nestjs.com/) packages for automatic lifecycle management:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { contract } from "./contract";

@Module({
  imports: [
    // Worker for consuming messages
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log("Processing:", message.orderId);
        },
      },
      connection: "amqp://localhost",
    }),
    // Client for publishing messages
    AmqpClientModule.forRoot({
      contract,
      connection: "amqp://localhost",
    }),
  ],
})
export class AppModule {}
```

📖 **[NestJS Documentation →](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage)**

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

### Guides

- [Getting Started](https://btravers.github.io/amqp-contract/guide/getting-started)
- [Core Concepts](https://btravers.github.io/amqp-contract/guide/core-concepts)
- [NestJS Client Usage](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage)
- [NestJS Worker Usage](https://btravers.github.io/amqp-contract/guide/worker-nestjs-usage)
- [AsyncAPI Generation](https://btravers.github.io/amqp-contract/guide/asyncapi-generation)
- [API Reference](https://btravers.github.io/amqp-contract/api/)
- [Examples](https://btravers.github.io/amqp-contract/examples/)

### Architecture & Design

- [Architecture Review](docs/review/2025-12-25-architecture-review.md) - Comprehensive project assessment
- [Review Summary](docs/review/2025-12-25-review-summary.md) - Executive summary
- [Terminology Guide](docs/TERMINOLOGY.md) - Understanding client/worker vs publisher/consumer
- [Architecture Decision Records](docs/adr/README.md) - Design decisions and rationale

## Packages

| Package                                                  | Description                              |
| -------------------------------------------------------- | ---------------------------------------- |
| [@amqp-contract/contract](./packages/contract)           | Contract builder and type definitions    |
| [@amqp-contract/client](./packages/client)               | Type-safe client for publishing messages |
| [@amqp-contract/worker](./packages/worker)               | Type-safe worker for consuming messages  |
| [@amqp-contract/client-nestjs](./packages/client-nestjs) | NestJS integration for client            |
| [@amqp-contract/worker-nestjs](./packages/worker-nestjs) | NestJS integration for worker            |
| [@amqp-contract/asyncapi](./packages/asyncapi)           | AsyncAPI 3.0 specification generator     |

## AsyncAPI Generation

```typescript
import { generateAsyncAPI } from "@amqp-contract/asyncapi";

const spec = generateAsyncAPI(contract, {
  info: {
    title: "My AMQP API",
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

## Topics

`amqp` · `rabbitmq` · `typescript` · `nodejs` · `nestjs` · `messaging` · `message-queue` · `message-broker` · `type-safe` · `schema-validation` · `contract-first` · `asyncapi` · `event-driven` · `microservices` · `amqplib`

## Contributing

See [CONTRIBUTING.md](https://github.com/btravers/amqp-contract/blob/main/CONTRIBUTING.md).

## License

MIT
