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

## Usage

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
