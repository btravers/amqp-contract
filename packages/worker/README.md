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
- ✅ **Automatic retry with exponential backoff** — Built-in retry mechanism using RabbitMQ TTL+DLX pattern
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

For advanced features like prefetch configuration, batch processing, and **automatic retry with exponential backoff**, see the [Worker Usage Guide](https://btravers.github.io/amqp-contract/guide/worker-usage).

#### Retry with Exponential Backoff

Enable automatic retry for failed messages:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // If this throws, message is automatically retried with exponential backoff
      await processPayment(message);
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3, // Retry up to 3 times
    initialDelayMs: 1000, // Start with 1 second delay
    maxDelayMs: 30000, // Max 30 seconds between retries
    backoffMultiplier: 2, // Double the delay each time
    jitter: true, // Add randomness to prevent thundering herd
  },
});
```

The retry mechanism uses RabbitMQ's native TTL and Dead Letter Exchange pattern, so it doesn't block the consumer during retry delays. See the [Error Handling and Retry](https://btravers.github.io/amqp-contract/guide/worker-usage#error-handling-and-retry) section in the guide for complete details.

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
      // With retry configured: message is retried with exponential backoff
      // Without retry: message is immediately requeued
      throw error;
    }
  };
}
```

**Error Types:**

Worker defines error classes:

- `TechnicalError` - Runtime failures (parsing, processing)
- `MessageValidationError` - Message fails schema validation
- `RetryableError` - Optional error class for explicit retry signaling (all errors are retryable by default when retry is configured)

**Handlers don't need to use these error classes** - just throw standard exceptions. The worker handles retry automatically based on your configuration.

## API

For complete API documentation, see the [Worker API Reference](https://btravers.github.io/amqp-contract/api/worker).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
