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
import { TypedAmqpWorker, RetryableError } from "@amqp-contract/worker";
import type { Logger } from "@amqp-contract/core";
import { Future } from "@swan-io/boxed";
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
    processOrder: ({ payload }) => {
      console.log("Processing order:", payload.orderId);

      // Your business logic here
      return Future.fromPromise(Promise.all([processPayment(payload), updateInventory(payload)]))
        .mapOk(() => undefined)
        .mapError((error) => new RetryableError("Order processing failed", error));
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

Retry is configured at the queue level in your contract definition. Add `retry` to your queue definition:

```typescript
import { defineQueue, defineExchange, defineContract } from "@amqp-contract/contract";

const dlx = defineExchange("orders-dlx", "topic", { durable: true });

// Configure retry at queue level
const orderQueue = defineQueue("order-processing", {
  deadLetter: { exchange: dlx },
  retry: {
    mode: "ttl-backoff",
    maxRetries: 3, // Retry up to 3 times (default: 3)
    initialDelayMs: 1000, // Start with 1 second delay (default: 1000)
    maxDelayMs: 30000, // Max 30 seconds between retries (default: 30000)
    backoffMultiplier: 2, // Double the delay each time (default: 2)
    jitter: true, // Add randomness to prevent thundering herd (default: true)
  },
});
```

Then use `RetryableError` in your handlers:

```typescript
import { TypedAmqpWorker, RetryableError } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: ({ payload }) =>
      // If this fails with RetryableError, message is automatically retried
      Future.fromPromise(processPayment(payload))
        .mapOk(() => undefined)
        .mapError((error) => new RetryableError("Payment failed", error)),
  },
  urls: ["amqp://localhost"],
});
```

The retry mechanism uses RabbitMQ's native TTL and Dead Letter Exchange pattern, so it doesn't block the consumer during retry delays. See the [Error Handling and Retry](https://btravers.github.io/amqp-contract/guide/worker-usage#error-handling-and-retry) section in the guide for complete details.

## Defining Handlers Externally

You can define handlers outside of the worker creation using `defineHandler` and `defineHandlers` for better code organization. See the [Worker API documentation](https://btravers.github.io/amqp-contract/api/worker) for details.

## Error Handling

Worker handlers return `Future<Result<void, HandlerError>>` for explicit error handling:

```typescript
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";

handlers: {
  processOrder: ({ payload }) => {
    // Validation errors - non-retryable
    if (payload.amount <= 0) {
      return Future.value(Result.Error(new NonRetryableError("Invalid amount")));
    }

    // Transient errors - retryable
    return Future.fromPromise(process(payload))
      .mapOk(() => undefined)
      .mapError((error) => new RetryableError("Processing failed", error));
  },
}
```

**Error Types:**

Worker defines error classes:

- `TechnicalError` - Runtime failures (parsing, processing)
- `MessageValidationError` - Message fails schema validation
- `RetryableError` - Signals that the error is transient and should be retried
- `NonRetryableError` - Signals permanent failure, message goes to DLQ

## API

For complete API documentation, see the [Worker API Reference](https://btravers.github.io/amqp-contract/api/worker).

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
