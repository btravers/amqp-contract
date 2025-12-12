# @amqp-contract/zod

Zod integration for amqp-contract. This package provides seamless integration between [Zod](https://zod.dev/) schemas and amqp-contract.

## Installation

```bash
npm install @amqp-contract/zod
# or
pnpm add @amqp-contract/zod
# or
yarn add @amqp-contract/zod
```

## Usage

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
  z,
} from '@amqp-contract/zod';

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

## Features

- **Type Safety**: Full TypeScript support with type inference from Zod schemas
- **Standard Schema**: Uses the Standard Schema specification for interoperability
- **Convenience**: Re-exports both amqp-contract builders and Zod for easy imports

## License

MIT
