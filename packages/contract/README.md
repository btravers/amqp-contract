# @amqp-contract/contract

**Contract builder for amqp-contract - Define type-safe AMQP messaging contracts.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/contract.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/contract)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/contract.svg)](https://www.npmjs.com/package/@amqp-contract/contract)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/contract)**

## Installation

```bash
pnpm add @amqp-contract/contract
```

## Quick Start

### Recommended: Publisher-First / Consumer-First Patterns

For robust contract definitions with guaranteed consistency, use `definePublisherFirst` (for events) or `defineConsumerFirst` (for commands):

```typescript
import {
  definePublisherFirst,
  defineContract,
  defineExchange,
  defineQueue,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Event-oriented pattern: publisher doesn't need to know about queues
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

const { publisher: orderCreatedPublisher, createConsumer: createOrderCreatedConsumer } =
  definePublisherFirst(ordersExchange, orderMessage, { routingKey: "order.created" });

// Multiple queues can consume the same event
const orderQueue = defineQueue("order-processing", { durable: true });
const { consumer, binding } = createOrderCreatedConsumer(orderQueue);

// For topic exchanges, consumers can override with their own pattern
const analyticsQueue = defineQueue("analytics", { durable: true });
const { consumer: analyticsConsumer, binding: analyticsBinding } = createOrderCreatedConsumer(
  analyticsQueue,
  "order.*",
); // Subscribe to all order events

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderQueue, analyticsQueue },
  bindings: { orderBinding: binding, analyticsBinding },
  publishers: { orderCreated: orderCreatedPublisher },
  consumers: {
    processOrder: consumer,
    trackOrders: analyticsConsumer,
  },
});
```

**Benefits:**

- ✅ Guaranteed message schema consistency between publishers and consumers
- ✅ Routing key validation and type safety
- ✅ Full type safety with TypeScript inference
- ✅ Event-oriented (publisher-first) and command-oriented (consumer-first) patterns
- ✅ Flexible routing key patterns for topic exchanges

## Production-Ready Error Handling

### Retry Policies

For production use, configure retry policies on your consumers to prevent infinite retry loops:

```typescript
import {
  defineConsumer,
  defineQueue,
  defineMessage,
  defineExchange,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define a dead letter exchange for failed messages
const dlxExchange = defineExchange("orders-dlx", "topic", { durable: true });
const dlxQueue = defineQueue("orders-failed", { durable: true });

// Configure queue with dead letter exchange
const orderQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: dlxExchange,
    routingKey: "order.failed",
  },
});

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

// Define consumer with retry policy
const processOrderConsumer = defineConsumer(orderQueue, orderMessage, {
  retryPolicy: {
    maxRetries: 3, // Retry up to 3 times
    backoff: {
      type: "exponential", // Exponential backoff
      initialDelay: 1000, // Start with 1 second
      maxDelay: 60000, // Cap at 60 seconds
      multiplier: 2, // Double each time
    },
  },
});
```

**Retry Policy Configuration:**

- `maxRetries`: Number of retry attempts (0 for fail-fast)
- `backoff.type`: `"fixed"` or `"exponential"`
- `backoff.initialDelay`: Initial delay in milliseconds (default: 1000)
- `backoff.maxDelay`: Maximum delay for exponential backoff (default: 60000)
- `backoff.multiplier`: Multiplier for exponential backoff (default: 2)

**How it works:**

1. Message processing fails and throws an exception
2. Worker retries the message according to the retry policy
3. Exponential backoff delays increase between retries (e.g., 1s, 2s, 4s, 8s...)
4. After exhausting retries, message is sent to the dead letter exchange
5. Failed messages can be inspected, reprocessed, or logged from the DLX

### Dead Letter Exchange Setup

```typescript
const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
    ordersDlx: dlxExchange,
  },
  queues: {
    orderProcessing: orderQueue,
    ordersFailed: dlxQueue,
  },
  bindings: {
    orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
      routingKey: "order.created",
    }),
    dlxBinding: defineQueueBinding(dlxQueue, dlxExchange, {
      routingKey: "order.failed",
    }),
  },
  consumers: {
    processOrder: processOrderConsumer,
    handleFailedOrders: defineConsumer(dlxQueue, orderMessage),
  },
});
```

**Benefits:**

- ✅ Prevents infinite retry loops
- ✅ Exponential backoff reduces load during outages
- ✅ Failed messages are preserved for analysis
- ✅ Can implement dead letter queue monitoring and alerting

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

- [Getting Started Guide](https://btravers.github.io/amqp-contract/guide/defining-contracts)
- [Publisher-First Pattern](https://btravers.github.io/amqp-contract/guide/defining-contracts#publisher-first-pattern)
- [Consumer-First Pattern](https://btravers.github.io/amqp-contract/guide/defining-contracts#consumer-first-pattern)
- [Complete API Reference](https://btravers.github.io/amqp-contract/api/contract)

## License

MIT
