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

### Merging Contracts (Subdomains)

Split your AMQP topology into logical subdomains or modules and merge them together:

```typescript
import { mergeContracts } from '@amqp-contract/contract';

// Define order subdomain
const orderContract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
});

// Define payment subdomain
const paymentContract = defineContract({
  exchanges: {
    payments: defineExchange('payments', 'topic', { durable: true }),
  },
  queues: {
    paymentProcessing: defineQueue('payment-processing', { durable: true }),
  },
  publishers: {
    paymentReceived: definePublisher(paymentsExchange, paymentMessage, {
      routingKey: 'payment.received',
    }),
  },
});

// Merge subdomains into a single contract
const appContract = mergeContracts(orderContract, paymentContract);

// Use the merged contract with client and worker
const client = await TypedAmqpClient.create({ contract: appContract, connection });
await client.publish('orderCreated', orderData);
await client.publish('paymentReceived', paymentData);
```

**Benefits:**

- **Modular architecture** - Split large contracts into logical domains
- **Team ownership** - Different teams can own different contract modules
- **Reusability** - Share common infrastructure contracts across applications
- **Better testing** - Test subdomains in isolation

## API

For complete API documentation, see the [Contract API Reference](https://btravers.github.io/amqp-contract/api/contract).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
