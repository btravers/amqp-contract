# Basic Order Processing - Contract

Shared contract definition demonstrating **Publisher-First** and **Consumer-First** patterns with AMQP.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**

## Overview

This package demonstrates the **recommended approach** for defining contracts:

- ✅ **Publisher-First Pattern** (Event-Oriented): For events where publishers don't need to know about queues
- ✅ **Consumer-First Pattern** (Command-Oriented): For commands where consumers define expectations
- Traditional patterns: For advanced scenarios like exchange-to-exchange bindings

## Quick Example

```typescript
import { contract } from "@amqp-contract-samples/basic-order-processing-contract";
import { TypedAmqpClient } from "@amqp-contract/client";

const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
});

if (clientResult.isError()) {
  throw clientResult.error; // Handle connection error
}

const client = clientResult.get();
await client.publish("orderCreated", {
  /* fully typed */
});
```

## Patterns Demonstrated

### Publisher-First (Event-Oriented)

- `orderCreatedEvent`: One event, multiple consumers (processing + notifications)
- Guarantees message schema consistency
- Automatic routing key synchronization

### Consumer-First (Command-Oriented)

- `shipOrderCommand`: Consumer defines contract, publisher matches
- Type-safe command pattern

### Traditional Approach

- Exchange-to-exchange bindings
- Complex routing patterns

## Running Tests

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-contract test
```

For detailed documentation about patterns and routing keys, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
