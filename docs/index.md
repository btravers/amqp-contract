---
layout: home
title: amqp-contract - Type-safe AMQP/RabbitMQ messaging for TypeScript
description: End-to-end type safety, runtime validation, and reliable retry patterns for AMQP/RabbitMQ messaging in TypeScript and NestJS

hero:
  name: "amqp-contract"
  text: "Type-safe contracts for AMQP/RabbitMQ"
  tagline: End-to-end type safety · Runtime validation · Reliable retry patterns
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
      text: GitHub
      link: https://github.com/btravers/amqp-contract

features:
  - icon: 🔒
    title: Type Safety & Validation
    details: End-to-end TypeScript inference with automatic runtime validation using Zod, Valibot, or ArkType.

  - icon: 🔄
    title: Reliable Retry
    details: Built-in exponential backoff using RabbitMQ's native TTL and Dead Letter Exchange pattern.

  - icon: 📄
    title: AsyncAPI Compatible
    details: Generate AsyncAPI 3.0 specs for documentation, visualization, and breaking change detection.

  - icon: 🎯
    title: NestJS Ready
    details: First-class NestJS support with dependency injection and automatic lifecycle management.
---

## Quick Example

Define your contract once — get type safety everywhere:

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

const ordersExchange = defineExchange("orders", "topic", { durable: true });
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", {
  deadLetter: { exchange: ordersDlx },
  retry: { mode: "ttl-backoff" }, // Automatic retry with exponential backoff
});

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, { routingKey: "order.created" });

const { consumer: processOrderConsumer, binding: orderBinding } =
  createOrderCreatedConsumer(orderProcessingQueue);

export const contract = defineContract({
  exchanges: { orders: ordersExchange, ordersDlx },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: { orderBinding },
  publishers: { orderCreated: orderCreatedPublisher },
  consumers: { processOrder: processOrderConsumer },
});
```

```typescript [2. Publish]
import { TypedAmqpClient } from "@amqp-contract/client";
import { contract } from "./contract";

const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
}).resultToPromise();

await client.publish("orderCreated", {
  orderId: "ORD-123", // ✅ TypeScript knows!
  amount: 99.99,
});
```

```typescript [3. Consume]
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";
import { contract } from "./contract";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: ({ payload }) => {
      console.log(payload.orderId); // ✅ Fully typed!
      return Future.value(Result.Ok(undefined));
    },
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

:::
