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

Worker handlers use standard Promise-based async/await pattern with built-in retry support:

```typescript
import { TypedAmqpWorker, RetryableError, NonRetryableError } from "@amqp-contract/worker";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      try {
        await processPayment(message);
        // Message acknowledged automatically on success
      } catch (error) {
        // Distinguish between retryable and non-retryable errors
        if (error instanceof TimeoutError) {
          // Transient failure - will be retried with exponential backoff
          throw new RetryableError("Payment service timeout", error);
        }
        if (error instanceof ValidationError) {
          // Permanent failure - goes directly to DLQ
          throw new NonRetryableError("Invalid payment data", error);
        }
        // Unknown errors are retried by default
        throw error;
      }
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },
}).resultToPromise();
```

### Error Types

**User-facing error classes** (throw these in your handlers):

- `RetryableError` - Transient failures that may succeed on retry (network timeouts, rate limiting, temporary unavailability)
- `NonRetryableError` - Permanent failures that will never succeed (validation errors, business logic violations, missing resources)

**Internal error classes** (logged automatically, don't throw):

- `TechnicalError` - Runtime failures (parsing, processing)
- `MessageValidationError` - Message fails schema validation

### Retry Configuration

Configure retry behavior via the `retry` option:

- `maxRetries` - Maximum retry attempts before sending to DLQ (default: 3)
- `initialDelayMs` - Initial delay before first retry (default: 1000ms)
- `maxDelayMs` - Maximum delay between retries (default: 30000ms)
- `backoffMultiplier` - Multiplier for exponential backoff (default: 2)
- `jitter` - Add random jitter to prevent thundering herd (default: true)

### Dead Letter Queues (DLQ)

Messages are automatically routed to a Dead Letter Exchange after:

- Max retries are exceeded for `RetryableError`
- Any `NonRetryableError` is thrown (immediately)
- Validation or parsing errors occur

Configure DLQ at the queue level in your contract:

```typescript
const queue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: dlqExchange,
    routingKey: "order.failed",
  },
});
```

For more details, see the [Error Handling Guide](https://btravers.github.io/amqp-contract/guide/error-handling).

## API

For complete API documentation, see the [Worker API Reference](https://btravers.github.io/amqp-contract/api/worker).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
