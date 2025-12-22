# @amqp-contract/contract

Contract builder for amqp-contract - Define type-safe AMQP messaging contracts.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/contract)**

## Installation

```bash
pnpm add @amqp-contract/contract
```

## Usage

```typescript
import { defineContract, defineExchange, defineQueue, defineBinding, defineExchangeBinding, definePublisher, defineConsumer } from '@amqp-contract/contract';
import { z } from 'zod';

// Define your contract
const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
    analytics: defineExchange('analytics', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
    analyticsProcessing: defineQueue('analytics-processing', { durable: true }),
  },
  bindings: {
    // Queue-to-exchange binding
    orderBinding: defineBinding('order-processing', 'orders', {
      routingKey: 'order.created',
    }),
    // Exchange-to-exchange binding
    analyticsBinding: defineExchangeBinding('analytics', 'orders', {
      routingKey: 'order.#',
    }),
    // Queue receives from analytics exchange
    analyticsQueueBinding: defineBinding('analytics-processing', 'analytics', {
      routingKey: 'order.#',
    }),
  },
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
      amount: z.number(),
    }), {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', z.object({
      orderId: z.string(),
      amount: z.number(),
    }), {
      prefetch: 10,
    }),
    processAnalytics: defineConsumer('analytics-processing', z.object({
      orderId: z.string(),
      amount: z.number(),
    })),
  },
});
```

## API

### `defineExchange(name, type, options?)`

Define an AMQP exchange.

### `defineQueue(name, options?)`

Define an AMQP queue.

### `defineBinding(queue, exchange, options?)`

Define a binding between a queue and an exchange.

### `defineExchangeBinding(destination, source, options?)`

Define a binding between two exchanges (source → destination). Messages published to the source exchange will be routed to the destination exchange based on the routing key pattern.

### `definePublisher(exchange, messageSchema, options?)`

Define a message publisher with validation schema.

### `defineConsumer(queue, messageSchema, options?)`

Define a message consumer with validation schema.

### `defineContract(definition)`

Create a complete AMQP contract with exchanges, queues, bindings, publishers, and consumers.

## License

MIT
