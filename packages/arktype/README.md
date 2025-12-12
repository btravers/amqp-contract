# @amqp-contract/arktype

ArkType integration for amqp-contract. This package provides seamless integration between [ArkType](https://arktype.io/) schemas and amqp-contract.

## Installation

```bash
npm install @amqp-contract/arktype
# or
pnpm add @amqp-contract/arktype
# or
yarn add @amqp-contract/arktype
```

## Usage

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
  type,
} from '@amqp-contract/arktype';

// Define your schemas using ArkType
const orderSchema = type({
  orderId: 'string',
  amount: 'number',
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

- **Type Safety**: Full TypeScript support with type inference from ArkType schemas
- **Standard Schema**: Uses the Standard Schema specification for interoperability
- **Convenience**: Re-exports both amqp-contract builders and ArkType for easy imports

## License

MIT
