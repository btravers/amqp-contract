# Basic Order Processing - Contract

Shared contract definition demonstrating the AMQP topic exchange pattern.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**

## Overview

This package defines the contract for:

- Message schemas (Order, OrderStatus)
- Exchanges and queues
- Publishers and consumers
- Routing key patterns with wildcards

## Quick Example

```typescript
import { contract } from '@amqp-contract-samples/basic-order-processing-contract';
import { TypedAmqpClient } from '@amqp-contract/client';

const clientResult = await TypedAmqpClient.create({ 
  contract, 
  urls: ['amqp://localhost'] 
});

if (clientResult.isError()) {
  throw clientResult.error; // Handle connection error
}

const client = clientResult.get();
await client.publish('orderCreated', { /* fully typed */ });
```

## Running Tests

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-contract test
```

For detailed documentation about the topic pattern and routing keys, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
