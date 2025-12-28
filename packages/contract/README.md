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
import { definePublisherFirst, defineContract, defineExchange, defineQueue, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

// Event-oriented pattern: publisher doesn't need to know about queues
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderMessage = defineMessage(z.object({
  orderId: z.string(),
  amount: z.number(),
}));

const {
  publisher: orderCreatedPublisher,
  createConsumer: createOrderCreatedConsumer,
} = definePublisherFirst(
  ordersExchange,
  orderMessage,
  { routingKey: 'order.created' }
);

// Multiple queues can consume the same event
const orderQueue = defineQueue('order-processing', { durable: true });
const { consumer, binding } = createOrderCreatedConsumer(orderQueue);

// For topic exchanges, consumers can override with their own pattern
const analyticsQueue = defineQueue('analytics', { durable: true });
const { consumer: analyticsConsumer, binding: analyticsBinding } =
  createOrderCreatedConsumer(analyticsQueue, 'order.*');  // Subscribe to all order events

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

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

- [Getting Started Guide](https://btravers.github.io/amqp-contract/guide/defining-contracts)
- [Publisher-First Pattern](https://btravers.github.io/amqp-contract/guide/defining-contracts#publisher-first-pattern)
- [Consumer-First Pattern](https://btravers.github.io/amqp-contract/guide/defining-contracts#consumer-first-pattern)
- [Complete API Reference](https://btravers.github.io/amqp-contract/api/contract)

## License

MIT
