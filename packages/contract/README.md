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

### Recommended: Event / Command Patterns

For robust contract definitions with guaranteed consistency, use Event or Command patterns:

| Pattern     | Use Case                                   | Flow                                               |
| ----------- | ------------------------------------------ | -------------------------------------------------- |
| **Event**   | One publisher, many consumers (broadcast)  | `defineEventPublisher` → `defineEventConsumer`     |
| **Command** | Many publishers, one consumer (task queue) | `defineCommandConsumer` → `defineCommandPublisher` |

```typescript
import {
  defineEventPublisher,
  defineEventConsumer,
  defineCommandConsumer,
  defineCommandPublisher,
  defineContract,
  defineExchange,
  defineQueue,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Event pattern: publisher broadcasts, consumers subscribe
const ordersExchange = defineExchange("orders");
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

// Define event publisher
const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

// Multiple queues can consume the same event
const orderQueue = defineQueue("order-processing", { durable: true });
const analyticsQueue = defineQueue("analytics", { durable: true });

// Compose contract - exchanges, queues, bindings auto-extracted
const contract = defineContract({
  publishers: {
    // EventPublisherConfig → auto-extracted to publisher
    orderCreated: orderCreatedEvent,
  },
  consumers: {
    // EventConsumerResult → auto-extracted to consumer + binding
    processOrder: defineEventConsumer(orderCreatedEvent, orderQueue),
    // For topic exchanges, consumers can override with their own pattern
    trackOrders: defineEventConsumer(orderCreatedEvent, analyticsQueue, {
      routingKey: "order.*", // Subscribe to all order events
    }),
  },
});
```

**Benefits:**

- ✅ Guaranteed message schema consistency between publishers and consumers
- ✅ Routing key validation and type safety
- ✅ Full type safety with TypeScript inference
- ✅ Event-oriented and command-oriented patterns
- ✅ Flexible routing key patterns for topic exchanges

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

- [Getting Started Guide](https://btravers.github.io/amqp-contract/guide/defining-contracts)
- [Event Pattern](https://btravers.github.io/amqp-contract/guide/defining-contracts#event-pattern)
- [Command Pattern](https://btravers.github.io/amqp-contract/guide/defining-contracts#command-pattern)
- [Complete API Reference](https://btravers.github.io/amqp-contract/api/contract)

## License

MIT
