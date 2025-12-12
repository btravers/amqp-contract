# @amqp-contract/valibot

Valibot integration for amqp-contract. This package declares peer dependencies for [Valibot](https://valibot.dev/) compatibility with amqp-contract.

## Installation

```bash
npm install @amqp-contract/contract @amqp-contract/valibot valibot
# or
pnpm add @amqp-contract/contract @amqp-contract/valibot valibot
# or
yarn add @amqp-contract/contract @amqp-contract/valibot valibot
```

## Usage

```typescript
import * as v from 'valibot';
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
} from '@amqp-contract/contract';

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
- **Peer Dependency Management**: Declares compatible Valibot versions as peer dependencies

## License

MIT
