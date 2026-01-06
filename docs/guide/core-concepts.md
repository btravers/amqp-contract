---
title: Core Concepts - Understanding Type-safe AMQP Messaging Contracts
description: Learn the fundamental concepts of amqp-contract including contract-first design, exchanges, queues, publishers, consumers, and schema validation for AMQP/RabbitMQ applications.
---

# Core Concepts

Understanding these core concepts will help you use amqp-contract effectively.

## Contract-First Design

Everything starts with a **contract** that defines:

- **Exchanges** - Where messages are published
- **Queues** - Where messages are stored
- **Bindings** - How queues connect to exchanges
- **Publishers** - What messages can be published
- **Consumers** - What messages can be consumed

Define once, use everywhere with full type safety.

## End-to-End Type Safety

Type safety flows automatically from your contract:

```typescript
import { z } from "zod";

// 1. Define resources and message
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

// 2. Publisher-first pattern (recommended for events)
const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, { routingKey: "order.created" });

// 3. Create consumer from event
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const { consumer: processOrderConsumer, binding: orderBinding } =
  createOrderCreatedConsumer(orderProcessingQueue);

// 4. Compose contract
const contract = defineContract({
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

// 5. Client knows exact types
const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
});

if (clientResult.isError()) {
  throw clientResult.error; // Handle connection error
}

const client = clientResult.get();

const result = await client.publish("orderCreated", {
  orderId: "ORD-123", // ✅ TypeScript knows!
  amount: 99.99, // ✅ TypeScript knows!
  // invalid: true,     // ❌ TypeScript error!
});

result.match({
  Ok: () => console.log("Published"),
  Error: (error) => console.error("Failed:", error),
});
```

## Automatic Validation

Messages are validated automatically at network boundaries:

- **On publish**: Client validates before sending
- **On consume**: Worker validates before calling handlers

Invalid messages are caught early with clear error messages.

```typescript
// This returns a validation error (doesn't throw)
const result = await client.publish("orderCreated", {
  orderId: "ORD-123",
  amount: "not-a-number", // ❌ Validation error!
});

result.match({
  Ok: () => console.log("Published"),
  Error: (error) => {
    // Handle MessageValidationError or TechnicalError
    console.error("Failed:", error.message);
  },
});
```

## Schema Libraries

amqp-contract uses [Standard Schema](https://github.com/standard-schema/standard-schema), supporting:

- ✅ [Zod](https://zod.dev/) (most popular)
- ✅ [Valibot](https://valibot.dev/)
- ✅ [ArkType](https://arktype.io/)

All examples use [Zod](https://zod.dev/), but you can use any compatible library:

```typescript
import { z } from "zod";
import * as v from "valibot";
import { type } from "arktype";

const ordersExchange = defineExchange("orders", "topic", { durable: true });

// All work the same way with definePublisherFirst:
const { publisher: zodPublisher, createConsumer: createZodConsumer } = definePublisherFirst(
  ordersExchange,
  defineMessage(z.object({ id: z.string() })),
  { routingKey: "order.created" },
);

const { publisher: valibotPublisher, createConsumer: createValibotConsumer } = definePublisherFirst(
  ordersExchange,
  defineMessage(v.object({ id: v.string() })),
  { routingKey: "order.created" },
);

const { publisher: arktypePublisher, createConsumer: createArktypeConsumer } = definePublisherFirst(
  ordersExchange,
  defineMessage(type({ id: "string" })),
  { routingKey: "order.created" },
);
```

## AMQP Resources

### Exchanges

Exchanges receive and route messages to queues:

```typescript
const ordersExchange = defineExchange(
  "orders", // name
  "topic", // type: direct, fanout, or topic
  { durable: true }, // options
);
```

**Exchange Types:**

- `direct` - Exact routing key match
- `topic` - Pattern matching with wildcards (`*`, `#`)
- `fanout` - Broadcast to all bound queues

### Queues

Queues store messages until consumed:

```typescript
const orderProcessingQueue = defineQueue(
  "order-processing", // name
  {
    durable: true, // survives broker restart
    exclusive: false, // shared across connections
  },
);
```

### Messages

Messages combine schemas with optional metadata:

```typescript
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  {
    summary: "Order created event",
    description: "Emitted when a new order is created",
  },
);
```

### Bindings

Bindings connect queues to exchanges:

```typescript
const orderBinding = defineQueueBinding(
  orderProcessingQueue, // queue
  ordersExchange, // exchange
  {
    routingKey: "order.created", // routing pattern
  },
);
```

### Publishers

Publishers define what messages can be published:

```typescript
const orderCreatedPublisher = definePublisher(
  ordersExchange, // exchange
  orderMessage, // message definition
  {
    routingKey: "order.created",
  },
);
```

### Consumers

Consumers define what messages can be consumed:

```typescript
const processOrderConsumer = defineConsumer(
  orderProcessingQueue, // queue
  orderMessage, // message definition
);
```

## Message Flow

Here's how messages flow through the system:

1. **Client publishes** a message
2. Message is **validated** against schema
3. Message sent to **exchange**
4. Exchange routes to **queues** via **bindings**
5. **Worker consumes** from queue
6. Message is **validated** again
7. Handler called with **typed message**
8. Message **acknowledged**

All with automatic type safety and validation!

## Next Steps

- Learn about [Defining Contracts](/guide/defining-contracts)
- Explore [Client Usage](/guide/client-usage)
- Understand [Worker Usage](/guide/worker-usage)
