# @amqp-contract/contract

Contract builder for amqp-contract - Define type-safe AMQP messaging contracts.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/contract)**

## Installation

```bash
pnpm add @amqp-contract/contract
```

## Usage

```typescript
import { defineContract, defineExchange, defineQueue, defineBinding, defineExchangeBinding, definePublisher, defineConsumer, defineMessage } from '@amqp-contract/contract';
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
    orderBinding: defineBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
    // Exchange-to-exchange binding
    analyticsBinding: defineExchangeBinding(analyticsExchange, ordersExchange, {
      routingKey: 'order.#',
    }),
    // Queue receives from analytics exchange
    analyticsQueueBinding: defineBinding(analyticsProcessingQueue, analyticsExchange, {
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

## API

### `defineExchange(name, type, options?)`

Define an AMQP exchange. Returns an exchange definition object that can be referenced by bindings and publishers.

**Types:** `'fanout'`, `'direct'`, or `'topic'`

### `defineQueue(name, options?)`

Define an AMQP queue. Returns a queue definition object that can be referenced by bindings and consumers.

### `defineMessage(payloadSchema, options?)`

Define a message definition with a payload schema and optional metadata (headers, summary, description).
This is useful for documentation generation and type inference.

### `defineBinding(queue, exchange, options?)`

Define a binding between a queue and an exchange. Pass the queue and exchange objects (not strings).

**Note:** `defineBinding` is an alias for `defineQueueBinding`.

### `defineExchangeBinding(destination, source, options?)`

Define a binding between two exchanges (source → destination). Messages published to the source exchange will be routed to the destination exchange based on the routing key pattern.

Pass the exchange objects (not strings).

### `definePublisher(exchange, message, options?)`

Define a message publisher with validation schema. Pass the exchange object (not a string).

**For fanout exchanges:** Routing key is optional (fanout ignores routing keys).
**For direct/topic exchanges:** Routing key is required in options.

### `defineConsumer(queue, message, options?)`

Define a message consumer with validation schema. Pass the queue object (not a string).

### `defineContract(definition)`

Create a complete AMQP contract with exchanges, queues, bindings, publishers, and consumers.

## Key Concepts

### Composition Pattern

The contract API uses a composition pattern where you:

1. Define exchanges and queues first as variables
2. Reference these objects in bindings, publishers, and consumers
3. Compose everything together in `defineContract`

This provides:

- **Better type safety**: TypeScript can validate exchange/queue types
- **Better refactoring**: Rename an exchange in one place
- **DRY principle**: Define once, reference many times

### Exchange Types & Routing Keys

The API enforces routing key requirements based on exchange type:

- **Fanout exchanges**: Don't use routing keys (all messages go to all bound queues)
- **Direct exchanges**: Require explicit routing keys for exact matching
- **Topic exchanges**: Require routing key patterns (e.g., `order.*`, `order.#`)

TypeScript enforces these rules at compile time through discriminated unions.

## License

MIT
