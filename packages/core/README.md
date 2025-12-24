# @amqp-contract/core

**Core utilities for AMQP setup and management in amqp-contract.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/core.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/core)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/core.svg)](https://www.npmjs.com/package/@amqp-contract/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This package provides centralized functionality for establishing AMQP topology (exchanges, queues, and bindings) from contract definitions, and defines the `Logger` interface used across amqp-contract packages.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract)**

## Installation

```bash
npm install @amqp-contract/core
# or
pnpm add @amqp-contract/core
# or
yarn add @amqp-contract/core
```

## Usage

### AmqpClient

The core package exports an `AmqpClient` class that handles the creation of all AMQP resources defined in a contract.

```typescript
import { AmqpClient } from "@amqp-contract/core";
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";

// Define resources
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });

// Define your contract
const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
  },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
  },
});

// Setup AMQP resources
const amqpClient = new AmqpClient(contract, {
  urls: ["amqp://localhost"],
});

// Clean up
await amqpClient.close();
```

### Logger Interface

The core package exports a `Logger` interface that can be used to implement custom logging for AMQP operations:

```typescript
import type { Logger } from "@amqp-contract/core";

const logger: Logger = {
  debug: (message, meta) => console.debug(message, meta),
  info: (message, meta) => console.info(message, meta),
  warn: (message, meta) => console.warn(message, meta),
  error: (message, meta) => console.error(message, meta),
};

// Pass the logger to client or worker
import { TypedAmqpClient } from "@amqp-contract/client";

const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
  logger, // Optional: logs published messages
});
```

## API

### `AmqpClient`

The `AmqpClient` class handles AMQP connection management and resource setup.

**Constructor:**

```typescript
new AmqpClient(contract: ContractDefinition, options: AmqpClientOptions)
```

**Parameters:**

- `contract`: Contract definition containing exchanges, queues, and bindings
- `options.urls`: Array of AMQP connection URLs
- `options.connectionOptions`: Optional connection manager options

**Methods:**

- `close(): Promise<void>` - Closes the channel and connection

### `Logger` Interface

The `Logger` interface defines the standard logging interface used by `@amqp-contract/client` and `@amqp-contract/worker`.

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

## Features

- ✅ Type-safe AMQP client with connection management
- ✅ Logger interface for custom logging implementations
- ✅ Supports all exchange types (topic, direct, fanout)
- ✅ Handles both queue-to-exchange and exchange-to-exchange bindings
- ✅ Passes custom arguments to AMQP resources
- ✅ Used internally by `@amqp-contract/client` and `@amqp-contract/worker`

## Related Packages

- [@amqp-contract/contract](../contract) - Contract definition builders
- [@amqp-contract/client](../client) - Type-safe AMQP client
- [@amqp-contract/worker](../worker) - Type-safe AMQP worker

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
