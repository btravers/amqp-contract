# @amqp-contract/arktype

ArkType integration for amqp-contract. This package declares peer dependencies for [ArkType](https://arktype.io/) compatibility with amqp-contract.

## Installation

```bash
npm install @amqp-contract/contract @amqp-contract/arktype arktype
# or
pnpm add @amqp-contract/contract @amqp-contract/arktype arktype
# or
yarn add @amqp-contract/contract @amqp-contract/arktype arktype
```

## Usage

```typescript
import { type } from 'arktype';
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
} from '@amqp-contract/contract';

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
- **Peer Dependency Management**: Declares compatible ArkType versions as peer dependencies

## License

MIT
