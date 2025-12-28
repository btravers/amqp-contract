# @amqp-contract/worker

**Type-safe AMQP worker for consuming messages using amqp-contract with standard async/await error handling.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/worker.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/worker)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/worker.svg)](https://www.npmjs.com/package/@amqp-contract/worker)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/worker)**

## Installation

```bash
pnpm add @amqp-contract/worker
```

## Features

- ✅ **Type-safe message consumption** — Handlers are fully typed based on your contract
- ✅ **Automatic validation** — Messages are validated before reaching your handlers
- ✅ **Prefetch configuration** — Control message flow with per-consumer prefetch settings
- ✅ **Batch processing** — Process multiple messages at once for better throughput
- ✅ **Automatic reconnection** — Built-in connection management with failover support

## Usage

### Basic Usage

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import type { Logger } from '@amqp-contract/core';
import { contract } from './contract';

// Optional: Create a logger implementation
const logger: Logger = {
  debug: (message, context) => console.debug(message, context),
  info: (message, context) => console.info(message, context),
  warn: (message, context) => console.warn(message, context),
  error: (message, context) => console.error(message, context),
};

// Create worker from contract with handlers (automatically connects and starts consuming)
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);

      // Your business logic here
      await processPayment(message);
      await updateInventory(message);

      // If an exception is thrown, the message is automatically requeued
    },
  },
  urls: ['amqp://localhost'],
  logger, // Optional: logs message consumption and errors
});

// Worker is already consuming messages

// Clean up when needed
// await worker.close();
```

### Prefetch Configuration

Control the number of unacknowledged messages a consumer can have:

```typescript
import { defineConsumer, defineQueue, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

const orderQueue = defineQueue('orders', { durable: true });
const orderMessage = defineMessage(z.object({
  orderId: z.string(),
  amount: z.number(),
}));

// Consumer with prefetch limit of 10 messages
const orderConsumer = defineConsumer(orderQueue, orderMessage, {
  prefetch: 10, // Process up to 10 messages concurrently
});

const contract = defineContract({
  // ... other definitions
  consumers: {
    processOrder: orderConsumer,
  },
});

// Handler receives single messages
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Process one message at a time
      console.log('Order:', message.orderId);
    },
  },
  urls: ['amqp://localhost'],
});
```

**Note:** In AMQP 0.9.1, prefetch is set per-channel. Since all consumers in a worker share the same channel, the worker will use the maximum prefetch value among all consumers. For example, if you have two consumers with prefetch values of 5 and 10, the effective prefetch for the channel will be 10.

### Batch Processing

Process multiple messages at once for better throughput:

```typescript
import { defineConsumer } from '@amqp-contract/contract';

// Consumer configured for batch processing
const orderConsumer = defineConsumer(orderQueue, orderMessage, {
  batchSize: 5,        // Process messages in batches of 5
  batchTimeout: 1000,  // Wait max 1 second to fill batch
  prefetch: 10,        // Optional: fetch more messages than batch size
});

const contract = defineContract({
  // ... other definitions
  consumers: {
    processOrders: orderConsumer,
  },
});

// Handler receives array of messages (TypeScript knows this!)
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrders: async (messages) => {
      // Process batch of messages
      console.log(`Processing ${messages.length} orders`);

      // Batch insert to database
      await db.orders.insertMany(messages.map(msg => ({
        id: msg.orderId,
        amount: msg.amount,
      })));

      // All messages are acked together on success
      // Or nacked together on error
    },
  },
  urls: ['amqp://localhost'],
});
```

**Batch Processing Notes:**

- Messages are accumulated until `batchSize` is reached
- If timeout is reached before batch is full, partial batch is processed
- All messages in a batch are acknowledged/rejected together
- If `prefetch` is not set, it defaults to `batchSize`
- Handler type automatically changes to `(messages: Array<T>) => Promise<void>`

## Defining Handlers Externally

You can define handlers outside of the worker creation using `defineHandler` and `defineHandlers` for better code organization. See the [Worker API documentation](https://btravers.github.io/amqp-contract/api/worker) for details.

## Error Handling

Worker handlers use standard Promise-based async/await pattern:

```typescript
handlers: {
  processOrder: async (message) => {
    // Standard async/await - no Result wrapping needed
    try {
      await process(message);
      // Message acknowledged automatically on success
    } catch (error) {
      // Exception automatically caught by worker
      // Message is requeued for retry
      throw error;
    }
  }
}
```

**Error Types:**

Worker defines error classes for internal use:

- `TechnicalError` - Runtime failures (parsing, processing)
- `MessageValidationError` - Message fails schema validation

These errors are logged but **handlers don't need to use them** - just throw standard exceptions.

## API

For complete API documentation, see the [Worker API Reference](https://btravers.github.io/amqp-contract/api/worker).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
