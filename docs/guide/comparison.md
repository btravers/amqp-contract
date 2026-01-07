---
title: Comparison - Why choose amqp-contract?
description: Compare amqp-contract with amqplib, @nestjs/microservices, tRPC, oRPC, and other messaging solutions. Understand when to use amqp-contract for type-safe RabbitMQ messaging.
---

# Comparison

How does **amqp-contract** compare to alternatives?

## vs Raw amqplib

[amqplib](https://github.com/amqp-node/amqplib) is the foundational Node.js client for AMQP. amqp-contract builds on top of it to provide type safety and better developer experience.

### Feature Comparison

| Feature                    | amqplib               | amqp-contract                         |
| -------------------------- | --------------------- | ------------------------------------- |
| **Type Safety**            | ❌ Manual types       | ✅ Automatic inference                |
| **Validation**             | ❌ Manual             | ✅ Automatic with Zod/Valibot/ArkType |
| **Developer Experience**   | ⚠️ Verbose, low-level | ✅ Intuitive, high-level API          |
| **Contract Documentation** | ❌ None               | ✅ Single source of truth             |
| **AsyncAPI Generation**    | ❌ No                 | ✅ Built-in                           |
| **Refactoring Safety**     | ❌ Runtime errors     | ✅ Compile-time errors                |
| **Learning Curve**         | Steep                 | Moderate                              |
| **Performance**            | Fastest               | Near-native (minimal overhead)        |
| **Flexibility**            | Maximum               | High                                  |

### Code Comparison

**Publishing a message:**

::: code-group

```typescript [❌ amqplib - Verbose & error-prone]
import * as amqp from "amqplib";

// Setup (repeated for every operation)
const connection = await amqp.connect("amqp://localhost");
const channel = await connection.createChannel();

// Declare resources manually
await channel.assertExchange("orders", "topic", { durable: true });
await channel.assertQueue("order-processing", { durable: true });
await channel.bindQueue("order-processing", "orders", "order.created");

// Publish - NO type checking, NO validation!
channel.publish(
  "orders",
  "order.created",
  Buffer.from(
    JSON.stringify({
      orderId: "ORD-123",
      amount: "99.99", // ❌ Should be number - no error!
      // ❌ Missing required fields - no error!
    }),
  ),
);

// Manual cleanup
await channel.close();
await connection.close();
```

```typescript [✅ amqp-contract - Type-safe & clean]
import { TypedAmqpClient } from "@amqp-contract/client";
import { contract } from "./contract.js";

// Create client once
const client = await TypedAmqpClient.create({
  contract, // Resources declared automatically!
  urls: ["amqp://localhost"],
}).resultToPromise();

// Publish - fully typed and validated!
const result = await client.publish("orderCreated", {
  orderId: "ORD-123",
  amount: 99.99, // ✅ Type-checked!
  customerId: "CUST-456", // ✅ Required fields enforced!
});

result.match({
  Ok: () => console.log("✅ Published"),
  Error: (error) => console.error("❌ Failed:", error),
}); // ✅ Automatic validation!

// Cleanup managed for you
await client.close();
```

:::

**Consuming messages:**

::: code-group

```typescript [❌ amqplib - Manual parsing]
import * as amqp from "amqplib";

const connection = await amqp.connect("amqp://localhost");
const channel = await connection.createChannel();

await channel.assertQueue("order-processing");

// No type safety!
channel.consume("order-processing", (msg) => {
  if (msg) {
    const data = JSON.parse(msg.content.toString()); // ❌ Any type!

    console.log(data.orderId); // ❌ No autocomplete!
    // ❌ No validation - runtime errors waiting to happen!

    channel.ack(msg); // Manual acknowledgment
  }
});
```

```typescript [✅ amqp-contract - Fully typed]
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract.js";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // ✅ Message is fully typed!
      console.log(message.orderId); // ✅ Full autocomplete!
      console.log(message.amount); // ✅ Type-safe!
      // ✅ Automatic validation - invalid messages rejected!
    }, // ✅ Auto-acknowledgment on success!
  },
  urls: ["amqp://localhost"],
}).resultToPromise();
```

:::

### When to use amqplib directly

**Choose amqplib if you:**

- Need absolute maximum performance (microseconds matter)
- Require low-level AMQP protocol control
- Working with legacy systems with unusual patterns
- Building a custom abstraction layer
- Writing simple one-off scripts

**Choose amqp-contract if you:**

- ✅ Building production applications
- ✅ Value type safety and developer experience
- ✅ Want to prevent runtime errors
- ✅ Need team collaboration with clear contracts
- ✅ Want AsyncAPI documentation

## vs @nestjs/microservices

[@nestjs/microservices](https://docs.nestjs.com/microservices/basics) provides RabbitMQ integration for NestJS applications. amqp-contract offers stronger type safety and works both with and without NestJS.

### Feature Comparison

| Feature                 | @nestjs/microservices          | amqp-contract            |
| ----------------------- | ------------------------------ | ------------------------ |
| **Type Safety**         | ⚠️ Decorators only             | ✅ End-to-end inference  |
| **Schema Validation**   | ❌ Manual pipes                | ✅ Automatic             |
| **Contract Definition** | ⚠️ Implicit in decorators      | ✅ Explicit, portable    |
| **AsyncAPI Generation** | ❌ No                          | ✅ Built-in              |
| **NestJS Integration**  | ✅ Native                      | ✅ First-class support   |
| **Standalone Usage**    | ❌ Requires NestJS             | ✅ Framework agnostic    |
| **Message Patterns**    | ⚠️ Limited to request/response | ✅ Full AMQP flexibility |
| **Learning Curve**      | Moderate                       | Gentle                   |

### Code Comparison

**Publisher:**

::: code-group

```typescript [@nestjs/microservices]
import { Injectable } from "@nestjs/common";
import { ClientProxy, MessagePattern } from "@nestjs/microservices";

@Injectable()
export class OrderService {
  constructor(
    @Inject("ORDERS_SERVICE")
    private client: ClientProxy,
  ) {}

  async createOrder(order: any) {
    // ❌ No type safety!
    // ❌ No validation!
    // ⚠️ Request/response pattern only
    return this.client.send("order.created", order);
  }
}
```

```typescript [amqp-contract]
import { Injectable } from "@nestjs/common";
import { AmqpClientService } from "@amqp-contract/client-nestjs";
import { contract } from "./contract.js";

@Injectable()
export class OrderService {
  constructor(private readonly amqpClient: AmqpClientService<typeof contract>) {}

  async createOrder(order: OrderInput) {
    // ✅ Fully typed!
    return this.amqpClient
      .publish("orderCreated", order) // ✅ Autocomplete!
      .resultToPromise(); // ✅ Automatic validation!
  }
}
```

:::

**Consumer:**

::: code-group

```typescript [@nestjs/microservices]
import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";

@Controller()
export class OrderController {
  @MessagePattern("order.created")
  async handleOrder(@Payload() order: any) {
    // ❌ No type safety!
    console.log(order.orderId); // ❌ No autocomplete!
    // ❌ No automatic validation!
    return { success: true };
  }
}
```

```typescript [amqp-contract]
// In module setup
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => {
      // ✅ Fully typed!
      console.log(message.orderId); // ✅ Full autocomplete!
      // ✅ Automatic validation!
    },
  },
  urls: ["amqp://localhost"],
});
```

:::

### When to use @nestjs/microservices

**Choose @nestjs/microservices if:**

- Already using it and happy with current implementation
- Only need simple request/response patterns
- Don't need AsyncAPI documentation
- Type safety is not a priority

**Choose amqp-contract if:**

- ✅ Need stronger end-to-end type safety
- ✅ Want automatic schema validation
- ✅ Need AsyncAPI documentation
- ✅ Want explicit, portable contracts
- ✅ Use full AMQP patterns (pub/sub, routing, etc.)
- ✅ Want to use outside NestJS too

::: tip
You can use amqp-contract WITH NestJS via [@amqp-contract/client-nestjs](/guide/client-nestjs-usage) and [@amqp-contract/worker-nestjs](/guide/worker-nestjs-usage)!
:::

## vs tRPC / oRPC

[tRPC](https://trpc.io/) and [oRPC](https://orpc.dev/) are excellent for type-safe RPC over HTTP, but they're designed for different use cases than AMQP messaging.

### Key Differences

| Aspect                  | tRPC / oRPC        | amqp-contract         |
| ----------------------- | ------------------ | --------------------- |
| **Protocol**            | HTTP / WebSocket   | AMQP 0.9.1            |
| **Pattern**             | Request/Response   | Pub/Sub, Routing, RPC |
| **Use Case**            | Client-server APIs | Backend microservices |
| **Message Delivery**    | Synchronous        | Asynchronous          |
| **Guaranteed Delivery** | No                 | Yes (RabbitMQ)        |
| **Load Balancing**      | App-level          | Queue-level           |
| **Decoupling**          | Tight coupling     | Loose coupling        |

### When to use each

**Use tRPC / oRPC for:**

- 📱 Frontend to backend communication
- 🌐 REST-like HTTP APIs
- 🔄 Request/response patterns
- 👤 User-facing APIs
- ⚡ Real-time with WebSockets

**Use amqp-contract for:**

- 🏗️ Backend-to-backend messaging
- 📬 Asynchronous task processing
- 🔄 Event-driven architectures
- 📊 Message queuing and buffering
- ⚖️ Load distribution across workers

::: tip Can you use both?
Yes! Use tRPC/oRPC for your frontend API and amqp-contract for backend services:

```typescript
// Frontend → tRPC → Backend → amqp-contract → Workers
```

:::

## vs GraphQL Subscriptions

[GraphQL Subscriptions](https://www.apollographql.com/docs/apollo-server/data/subscriptions/) enable real-time updates to clients. They serve a different purpose than AMQP.

### Key Differences

| Aspect          | GraphQL Subscriptions | amqp-contract         |
| --------------- | --------------------- | --------------------- |
| **Audience**    | External clients      | Internal services     |
| **Transport**   | WebSocket             | AMQP                  |
| **Schema**      | GraphQL SDL           | Zod/Valibot/ArkType   |
| **Discovery**   | Introspection         | AsyncAPI              |
| **Persistence** | No                    | Yes (RabbitMQ queues) |
| **Scalability** | Client connections    | Queue-based           |

### When to use each

**Use GraphQL Subscriptions for:**

- Real-time updates to web/mobile clients
- User-facing features (notifications, live data)
- Frontend-driven data requirements

**Use amqp-contract for:**

- Service-to-service communication
- Background job processing
- Internal event distribution
- Reliable message delivery

## vs Other Message Queue Libraries

### vs bull / bullmq

[Bull](https://github.com/OptimalBits/bull) is a Redis-based queue library for Node.js.

**Key Differences:**

- **Bull**: Simple job queue, Redis-based, good for background jobs
- **amqp-contract**: Full AMQP messaging, complex routing, RabbitMQ-based

**Choose Bull if:** You need simple background job processing with Redis

**Choose amqp-contract if:** You need complex routing, guaranteed delivery, or already use RabbitMQ

### vs AWS SQS / SNS

[AWS SQS/SNS](https://aws.amazon.com/sqs/) are managed message queue services.

**Key Differences:**

- **SQS/SNS**: Managed AWS service, pay-per-use, cloud-native
- **amqp-contract**: Self-hosted RabbitMQ, open-source, cloud-agnostic

**Choose SQS/SNS if:** You're on AWS and want fully managed services

**Choose amqp-contract if:** You want self-hosted, open-source, or multi-cloud

### vs Apache Kafka

[Apache Kafka](https://kafka.apache.org/) is a distributed streaming platform.

**Key Differences:**

- **Kafka**: Stream processing, high throughput, event sourcing
- **amqp-contract**: Message queuing, complex routing, RPC patterns

**Choose Kafka if:** You need log aggregation, stream processing, event sourcing at scale

**Choose amqp-contract if:** You need traditional message queuing with flexible routing

## Decision Matrix

### Choose amqp-contract if you:

- ✅ Use RabbitMQ or AMQP
- ✅ Build microservices with message-based communication
- ✅ Value end-to-end type safety
- ✅ Want automatic schema validation
- ✅ Need AsyncAPI documentation
- ✅ Use TypeScript
- ✅ Need complex routing patterns (topic, fanout, headers)
- ✅ Want compile-time error checking
- ✅ Work in a team with shared contracts

### Stick with alternatives if:

- ❌ You don't use message queues
- ❌ You need non-AMQP protocols (HTTP, gRPC, etc.)
- ❌ You have very simple, one-off messaging needs
- ❌ You're not using TypeScript
- ❌ Type safety is not important
- ❌ You need stream processing (use Kafka)
- ❌ You need managed cloud services (use SQS/SNS)

## Summary

**amqp-contract** is the best choice for:

1. TypeScript projects using RabbitMQ
2. Teams building microservices
3. Applications requiring type safety and validation
4. Projects needing AsyncAPI documentation
5. Developers who value great DX

It works **alongside** tools like tRPC (for frontend APIs) and complements your architecture rather than replacing other tools.

## Next Steps

Ready to get started?

- **[Quick Start →](/guide/quick-start)** - Get running in 5 minutes
- **[Why amqp-contract? →](/guide/why-amqp-contract)** - Learn more about the benefits
- **[Core Concepts →](/guide/core-concepts)** - Understand the fundamentals
- **[Examples →](/examples/)** - See real-world usage

::: tip Questions?
Check out the [Troubleshooting Guide](/guide/troubleshooting) or [open an issue](https://github.com/btravers/amqp-contract/issues) on GitHub!
:::
