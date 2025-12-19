# @amqp-contract/zod

Zod integration for amqp-contract. This package provides a schema converter for AsyncAPI generation and declares peer dependencies for [Zod](https://zod.dev/) compatibility with amqp-contract.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/guide/getting-started)**

## Installation

```bash
npm install @amqp-contract/contract @amqp-contract/zod zod
# or
pnpm add @amqp-contract/contract @amqp-contract/zod zod
# or
yarn add @amqp-contract/contract @amqp-contract/zod zod
```

## Usage

### Basic Usage

```typescript
import { z } from 'zod';
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
} from '@amqp-contract/contract';

// Define your schemas using Zod
const orderSchema = z.object({
  orderId: z.string(),
  amount: z.number(),
});

// Define your contract
const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher('orders', orderSchema),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', orderSchema),
  },
});
```

### AsyncAPI Generation

```typescript
import { zodToJsonSchema } from '@amqp-contract/zod';
import { generateAsyncAPI } from '@amqp-contract/asyncapi';

// Convert Zod schemas to JSON Schema for AsyncAPI
const jsonSchema = zodToJsonSchema(orderSchema);

// Generate AsyncAPI specification
const asyncAPISpec = generateAsyncAPI(contract, {
  info: {
    title: 'My API',
    version: '1.0.0',
  },
});
```

## Features

- **Type Safety**: Full TypeScript support with type inference from Zod schemas
- **Standard Schema**: Uses the Standard Schema specification for interoperability
- **AsyncAPI Support**: Provides `zodToJsonSchema` converter for AsyncAPI generation
- **Peer Dependency Management**: Declares compatible Zod versions as peer dependencies

## License

MIT
