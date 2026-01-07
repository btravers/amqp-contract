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
- ✅ **Retry policies** — Configurable retry limits with exponential backoff to prevent infinite loops
- ✅ **Dead letter exchange support** — Automatically route permanently failed messages to DLX
- ✅ **Prefetch configuration** — Control message flow with per-consumer prefetch settings
- ✅ **Batch processing** — Process multiple messages at once for better throughput
- ✅ **Automatic reconnection** — Built-in connection management with failover support

## Usage

### Basic Usage

```typescript
import { TypedAmqpWorker } from "@amqp-contract/worker";
import type { Logger } from "@amqp-contract/core";
import { contract } from "./contract";

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
      console.log("Processing order:", message.orderId);

      // Your business logic here
      await processPayment(message);
      await updateInventory(message);

      // If an exception is thrown, the message is automatically requeued
    },
  },
  urls: ["amqp://localhost"],
  logger, // Optional: logs message consumption and errors
});

// Worker is already consuming messages

// Clean up when needed
// await worker.close();
```

### Advanced Features

For advanced features like prefetch configuration and batch processing, see the [Worker Usage Guide](https://btravers.github.io/amqp-contract/guide/worker-usage).

## Defining Handlers Externally

You can define handlers outside of the worker creation using `defineHandler` and `defineHandlers` for better code organization. See the [Worker API documentation](https://btravers.github.io/amqp-contract/api/worker) for details.

## Error Handling

### Retry Policies (Production-Ready)

**For production use, always configure a retry policy** to prevent infinite retry loops and handle permanently failed messages gracefully.

```typescript
import { defineConsumer, defineQueue, defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

const orderQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: dlxExchange, // Messages that exceed retry limit go here
    routingKey: "order.failed",
  },
});

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

const processOrderConsumer = defineConsumer(orderQueue, orderMessage, {
  retryPolicy: {
    maxAttempts: 3, // Maximum 3 attempts (initial + 2 retries)
    backoff: {
      type: "exponential", // or "fixed"
      initialInterval: 1000, // Start with 1 second
      maxInterval: 60000, // Cap at 60 seconds
      coefficient: 2, // Double interval each retry (1s, 2s, 4s, ...)
    },
  },
});
```

**Retry Policy Options:**

- `maxAttempts`: Maximum number of attempts (initial + retries, set to `0` for fail-fast behavior)
- `backoff.type`: `"fixed"` (same interval) or `"exponential"` (increasing interval)
- `backoff.initialInterval`: Interval in milliseconds before first retry (default: 1000)
- `backoff.maxInterval`: Maximum interval for exponential backoff (default: 60000)
- `backoff.coefficient`: Multiplier for exponential backoff (default: 2)

**Behavior:**

- Messages are retried up to `maxAttempts` times with configurable backoff intervals
- Attempt count is tracked in message headers (`x-retry-count`)
- After exhausting attempts, messages are sent to the dead letter exchange (if configured)
- If no DLX is configured, messages are rejected without requeue

### Basic Error Handling

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
      // Message is retried according to retry policy
      throw error;
    }
  };
}
```

**Error Types:**

Worker defines error classes for internal use:

- `TechnicalError` - Runtime failures (parsing, processing)
- `MessageValidationError` - Message fails schema validation

These errors are logged but **handlers don't need to use them** - just throw standard exceptions.

### Migration from Legacy Behavior

If you have existing consumers without retry policies, they will continue to work with the legacy behavior (infinite retries). However, **this is not recommended for production** as it can lead to infinite retry loops.

To migrate:

1. Add a dead letter exchange to your queue configuration (optional but recommended)
2. Configure a retry policy on your consumer definition
3. Test with your actual failure scenarios to tune the retry parameters

## API

For complete API documentation, see the [Worker API Reference](https://btravers.github.io/amqp-contract/api/worker).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
