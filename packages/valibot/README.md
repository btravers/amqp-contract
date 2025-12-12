# @amqp-contract/valibot

Valibot integration for amqp-contract. This package provides seamless integration between [Valibot](https://valibot.dev/) schemas and amqp-contract.

## Installation

```bash
npm install @amqp-contract/valibot
# or
pnpm add @amqp-contract/valibot
# or
yarn add @amqp-contract/valibot
```

## Usage

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
  v,
} from '@amqp-contract/valibot';

// Define your schemas using Valibot
const orderSchema = v.object({
  orderId: v.string(),
  amount: v.number(),
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

- **Type Safety**: Full TypeScript support with type inference from Valibot schemas
- **Standard Schema**: Uses the Standard Schema specification for interoperability

## License

MIT
