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

## Why amqp-contract?

Define your AMQP contracts once — get **type safety**, **autocompletion**, and **runtime validation** everywhere.

- 🔒 **End-to-end type safety** — TypeScript knows your message shapes
- 🔄 **Reliable retry** — Built-in exponential backoff with Dead Letter Queue support
- 📄 **AsyncAPI compatible** — Generate documentation from your contracts

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
import { Future, Result } from "@swan-io/boxed";
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

// 7. Type-safe consuming with reliable retry (per-consumer configuration)
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: [
      ({ payload }) => {
        console.log(payload.orderId); // ✅ TypeScript knows!
        return Future.value(Result.Ok(undefined));
      },
      { retry: { maxRetries: 3, initialDelayMs: 1000 } },
    ],
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

## Installation

```bash
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
```

## Documentation

📖 **[Full Documentation →](https://btravers.github.io/amqp-contract)**

- [Get Started](https://btravers.github.io/amqp-contract/guide/getting-started) — Get running in 5 minutes
- [Core Concepts](https://btravers.github.io/amqp-contract/guide/core-concepts) — Understand the fundamentals
- [NestJS Integration](https://btravers.github.io/amqp-contract/guide/client-nestjs-usage) — First-class NestJS support
- [Examples](https://btravers.github.io/amqp-contract/examples/) — Real-world usage patterns

## Packages

| Package                                                  | Description                           |
| -------------------------------------------------------- | ------------------------------------- |
| [@amqp-contract/contract](./packages/contract)           | Contract builder and type definitions |
| [@amqp-contract/client](./packages/client)               | Type-safe client for publishing       |
| [@amqp-contract/worker](./packages/worker)               | Type-safe worker with retry support   |
| [@amqp-contract/client-nestjs](./packages/client-nestjs) | NestJS client integration             |
| [@amqp-contract/worker-nestjs](./packages/worker-nestjs) | NestJS worker integration             |
| [@amqp-contract/asyncapi](./packages/asyncapi)           | AsyncAPI 3.0 generator                |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
