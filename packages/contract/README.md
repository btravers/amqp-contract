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

## Usage

### Basic Contract Definition

```typescript
import { defineContract, defineExchange, defineQueue, defineQueueBinding, defineExchangeBinding, definePublisher, defineConsumer, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

// Define exchanges and queues first so they can be referenced
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const analyticsExchange = defineExchange('analytics', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });
const analyticsProcessingQueue = defineQueue('analytics-processing', { durable: true });

// Define message schemas with metadata
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  {
    summary: 'Order created event',
    description: 'Emitted when a new order is created',
  }
);

// Define your contract using object references
const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
    analytics: analyticsExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
    analyticsProcessing: analyticsProcessingQueue,
  },
  bindings: {
    // Queue-to-exchange binding
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
    // Exchange-to-exchange binding
    analyticsBinding: defineExchangeBinding(analyticsExchange, ordersExchange, {
      routingKey: 'order.#',
    }),
    // Queue receives from analytics exchange
    analyticsQueueBinding: defineQueueBinding(analyticsProcessingQueue, analyticsExchange, {
      routingKey: 'order.#',
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage, {
      prefetch: 10,
    }),
    processAnalytics: defineConsumer(analyticsProcessingQueue, orderMessage),
  },
});
```

### Enforcing Contract Consistency

**NEW**: Use `definePublisherFirst` or `defineConsumerFirst` to enforce consistency between publishers, consumers, and routing keys:

#### Publisher-First Pattern

Use when you start with a publisher and want to ensure consumers receive the same message type:

```typescript
import { definePublisherFirst, defineContract } from '@amqp-contract/contract';
import { z } from 'zod';

const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderQueue = defineQueue('order-processing', { durable: true });
const orderMessage = defineMessage(z.object({
  orderId: z.string(),
  amount: z.number(),
}));

// Define publisher-first relationship - ensures message and routing key consistency
const orderCreated = definePublisherFirst(
  ordersExchange,
  orderQueue,
  orderMessage,
  { routingKey: 'order.created' }
);

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderQueue },
  bindings: {
    orderBinding: orderCreated.binding, // Same routing key as publisher
  },
  publishers: {
    orderCreated: orderCreated.publisher, // Original publisher
  },
  consumers: {
    processOrder: orderCreated.createConsumer(), // Same message schema
  },
});
```

#### Consumer-First Pattern

Use when you start with a consumer and want to ensure publishers send the correct message type:

```typescript
import { defineConsumerFirst, defineContract } from '@amqp-contract/contract';
import { z } from 'zod';

const taskQueue = defineQueue('tasks', { durable: true });
const tasksExchange = defineExchange('tasks', 'direct', { durable: true });
const taskMessage = defineMessage(z.object({
  taskId: z.string(),
  action: z.string(),
}));

// Define consumer-first relationship - ensures message and routing key consistency
const taskConsumer = defineConsumerFirst(
  taskQueue,
  tasksExchange,
  taskMessage,
  { routingKey: 'task.execute' }
);

const contract = defineContract({
  exchanges: { tasks: tasksExchange },
  queues: { taskQueue },
  bindings: {
    taskBinding: taskConsumer.binding, // Same routing key as publisher
  },
  publishers: {
    executeTask: taskConsumer.createPublisher(), // Same message schema and routing key
  },
  consumers: {
    processTask: taskConsumer.consumer, // Original consumer
  },
});
```

#### Benefits

- ✅ **Message Schema Consistency**: Publishers and consumers are guaranteed to use the same message schema
- ✅ **Routing Key Consistency**: Routing keys are automatically synchronized between publishers and bindings
- ✅ **External Resource Support**: Can consume from exchanges defined in other contracts
- ✅ **Type Safety**: Full TypeScript type inference throughout
- ✅ **Single Source of Truth**: Message schema and routing key defined once, used everywhere

## API

For complete API documentation, see the [Contract API Reference](https://btravers.github.io/amqp-contract/api/contract).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
