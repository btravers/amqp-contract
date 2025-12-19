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
import { createClient } from '@amqp-contract/client';

const client = createClient(contract);
await client.publish('orderCreated', { /* fully typed */ });
```

## Running Tests

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-contract test
```

For detailed documentation about the topic pattern and routing keys, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
