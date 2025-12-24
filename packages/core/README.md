# @amqp-contract/core

**Core utilities for AMQP setup and management in amqp-contract.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/core.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/core)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/core.svg)](https://www.npmjs.com/package/@amqp-contract/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This package provides centralized functionality for establishing AMQP topology (exchanges, queues, and bindings) from contract definitions.

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

The core package exports a `setupInfra` function that handles the creation of all AMQP resources defined in a contract.

```typescript
import { connect } from "amqplib";
import { setupInfra } from "@amqp-contract/core";
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
const connection = await connect("amqp://localhost");
const channel = await connection.createChannel();

await setupInfra(channel, contract);
```

## API

### `setupInfra(channel: Channel, contract: ContractDefinition): Promise<void>`

Sets up all AMQP resources defined in the contract:

- **Exchanges**: Creates all exchanges with their configurations
- **Queues**: Creates all queues with their configurations
- **Bindings**: Creates all bindings (queue-to-exchange and exchange-to-exchange)

#### Parameters

- `channel`: AMQP channel to use for setup
- `contract`: Contract definition containing exchanges, queues, and bindings

#### Returns

A Promise that resolves when all resources are created.

## Features

- ✅ Type-safe contract setup
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

MIT © Benoit TRAVERS
