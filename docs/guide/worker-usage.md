# Worker Usage

Learn how to use the type-safe AMQP worker to consume messages.

::: tip NestJS Users
For NestJS applications, see the [NestJS Worker Usage](/guide/worker-nestjs-usage) guide.
:::

## Creating a Worker

Create a worker with type-safe message handlers:

```typescript
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract";

const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log("Processing:", message.orderId);
      // Your business logic here
    },
    notifyOrder: async (message) => {
      console.log("Notifying:", message.orderId);
    },
  },
  urls: ["amqp://localhost"],
});

workerResult.match({
  Ok: (worker) => console.log("✅ Worker ready!"),
  Error: (error) => {
    throw error;
  },
});
```

The worker automatically connects and starts consuming messages from all queues.

## Message Handlers

Handlers receive validated, fully-typed messages:

```typescript
const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Message is fully typed!
      console.log(message.orderId); // ✅ string
      console.log(message.amount); // ✅ number
      console.log(message.items); // ✅ array

      for (const item of message.items) {
        console.log(`${item.productId}: ${item.quantity}`);
      }
    },
  },
  connection,
});
```

### Type Safety

The worker enforces:

- ✅ **Required handlers** - All consumers must have handlers
- ✅ **Message validation** - Validated before reaching handlers
- ✅ **Type inference** - Fully typed parameters

```typescript
// ❌ TypeScript error: missing handler
const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    notifyOrder: async (message) => { ... },
    // Missing processOrder handler!
  },
  urls: ['amqp://localhost'],
});

// ✅ All handlers present
const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
    notifyOrder: async (message) => { ... },
  },
  urls: ['amqp://localhost'],
});

workerResult.match({
  Ok: (worker) => console.log('✅ All handlers present'),
  Error: (error) => {
    throw error;
  },
});
```

## Defining Handlers Externally

For better organization, define handlers separately:

### Single Handler

```typescript
import { defineHandler } from "@amqp-contract/worker";
import { contract } from "./contract";

const processOrderHandler = defineHandler(contract, "processOrder", async (message) => {
  console.log("Processing:", message.orderId);
  await saveToDatabase(message);
});

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: processOrderHandler,
  },
  urls: ["amqp://localhost"],
});
```

### Multiple Handlers

```typescript
import { defineHandlers } from "@amqp-contract/worker";
import { contract } from "./contract";

const handlers = defineHandlers(contract, {
  processOrder: async (message) => {
    await processPayment(message);
  },
  notifyOrder: async (message) => {
    await sendEmail(message);
  },
});

const worker = await TypedAmqpWorker.create({
  contract,
  handlers,
  urls: ["amqp://localhost"],
});
```

### Benefits

External handler definitions provide several advantages:

- **Better Organization**: Separate handler logic from worker setup code
- **Reusability**: Share handlers across multiple workers or test them independently
- **Type Safety**: Full TypeScript type checking at definition time
- **Testability**: Test handlers in isolation before integrating with workers
- **Maintainability**: Easier to modify and refactor handler logic

### Example: Organized Handler Module

Create a dedicated module for handlers:

```typescript
// handlers/order-handlers.ts
import { defineHandler, defineHandlers } from "@amqp-contract/worker";
import { orderContract } from "../contract";
import { processPayment } from "../services/payment";
import { sendEmail } from "../services/email";

export const processOrderHandler = defineHandler(orderContract, "processOrder", async (message) => {
  await processPayment(message);
});

export const notifyOrderHandler = defineHandler(orderContract, "notifyOrder", async (message) => {
  await sendEmail(message);
});

// Export all handlers together
export const orderHandlers = defineHandlers(orderContract, {
  processOrder: processOrderHandler,
  notifyOrder: notifyOrderHandler,
});
```

```typescript
// worker.ts
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { orderContract } from "./contract";
import { orderHandlers } from "./handlers/order-handlers";

const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: orderHandlers,
  urls: ["amqp://localhost"],
});
```

## Starting Consumers

### Automatic Consumption

By default, `TypedAmqpWorker.create` automatically starts all consumers defined in the contract:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
    notifyOrder: async (message) => { ... },
  },
  connection,
});
// Worker is already consuming messages from all queues
console.log('Worker ready, waiting for messages...');
```

### Manual Consumption

If you need more control, you can create a worker using the `TypedAmqpWorker` class directly and call `consume()` for specific consumers:

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';

const worker = new TypedAmqpWorker(contract, {
  processOrder: async (message) => { ... },
  notifyOrder: async (message) => { ... },
});

await worker.connect(connection);

// Start only the processOrder consumer
await worker.consume('processOrder');

// Start multiple consumers later
await worker.consume('notifyOrder');
```

## Message Acknowledgment

### Automatic Acknowledgment

By default, messages are automatically acknowledged after successful processing:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log("Processing:", message.orderId);
      // Message is automatically acked after this handler completes
    },
  },
  connection,
});
```

### Manual Acknowledgment

For more control, use manual acknowledgment:

```typescript
const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message, { ack, nack, reject }) => {
      try {
        await processOrder(message);
        ack(); // Acknowledge success
      } catch (error) {
        nack({ requeue: true }); // Requeue for retry
      }
    },
  },
  urls: ["amqp://localhost"],
});
```

**Options:**

- `ack()` - Acknowledge message
- `nack({ requeue: true })` - Requeue for retry
- `nack({ requeue: false })` - Discard message
- `reject({ requeue: false })` - Reject message

## Graceful Shutdown

Properly close the worker on shutdown:

```typescript
async function shutdown() {
  console.log("Shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

## Complete Example

```typescript
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { contract } from "./contract";

async function main() {
  const worker = await TypedAmqpWorker.create({
    contract,
    handlers: {
      processOrder: async (message, { ack, nack }) => {
        try {
          console.log(`Processing order ${message.orderId}`);

          await saveToDatabase(message);
          await sendConfirmation(message.customerId);

          ack();
        } catch (error) {
          console.error("Processing failed:", error);
          nack({ requeue: true });
        }
      },

      notifyOrder: async (message) => {
        console.log(`Sending notification for ${message.orderId}`);
        await sendEmail(message);
      },
    },
    urls: ["amqp://localhost"],
  });

  console.log("✅ Worker ready!");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(console.error);
```

## Advanced Features

### Prefetch Configuration

Control the number of unacknowledged messages a consumer can have at once. This helps manage memory usage and processing rate.

Use the tuple syntax `[handler, options]` to configure prefetch per-handler:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: [
      async (message) => {
        // Process one message at a time
        console.log("Order:", message.orderId);
        await saveToDatabase(message);
      },
      { prefetch: 10 }, // Process up to 10 messages concurrently
    ],
  },
  urls: ["amqp://localhost"],
});
```

::: warning Channel-Wide Prefetch
In AMQP 0.9.1, prefetch is set per-channel. Since all consumers in a worker share the same channel, the worker will use the **maximum prefetch value** among all consumers.

For example, if you have two consumers with prefetch values of 5 and 10, the effective prefetch for the channel will be 10.
:::

### Batch Processing

Process multiple messages at once for better throughput. This is especially useful for bulk database operations or API calls.

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrders: [
      async (messages) => {
        // Handler receives array of messages for batch processing
        console.log(`Processing ${messages.length} orders`);

        // Batch insert to database
        await db.orders.insertMany(
          messages.map((msg) => ({
            id: msg.orderId,
            amount: msg.amount,
          })),
        );

        // All messages are acked together on success
        // Or nacked together on error
      },
      {
        batchSize: 5, // Process messages in batches of 5
        batchTimeout: 1000, // Wait max 1 second to fill batch
        prefetch: 10, // Optional: fetch more messages than batch size
      },
    ],
  },
  urls: ["amqp://localhost"],
});
```

**Batch Processing Behavior:**

- Messages are accumulated until `batchSize` is reached
- If `batchTimeout` is reached before batch is full, the partial batch is processed
- All messages in a batch are acknowledged or rejected together
- If a consumer does not set `prefetch` but sets `batchSize`, that `batchSize` is used as its effective prefetch contribution
- The actual channel prefetch is the maximum effective prefetch across all consumers

**Type Safety:**

TypeScript automatically enforces the correct handler signature based on configuration:

```typescript
// Single message handler (no batchSize)
[async (message) => { ... }, { prefetch: 10 }]

// Batch handler (with batchSize)
[async (messages) => { ... }, { batchSize: 5 }]
```

### Handler Configuration Patterns

Three configuration patterns are supported:

1. **Simple handler** - No options

```typescript
handlers: {
  processOrder: async (message) => {
    // Single message processing
  };
}
```

2. **Handler with prefetch** - Control concurrency

```typescript
handlers: {
  processOrder: [
    async (message) => {
      // Single message processing with prefetch
    },
    { prefetch: 10 },
  ];
}
```

3. **Batch handler** - Process multiple messages

```typescript
handlers: {
  processOrders: [
    async (messages) => {
      // Batch processing
    },
    { batchSize: 5, batchTimeout: 1000 },
  ];
}
```

## Best Practices

1. **Handle Errors** - Always wrap business logic in try-catch
2. **Use Prefetch** - Limit concurrent messages with `prefetch` option to control memory usage
3. **Batch for Throughput** - Use batch processing for bulk operations (database inserts, API calls)
4. **Graceful Shutdown** - Properly close connections to finish processing in-flight messages
5. **Idempotency** - Handlers should be safe to retry since messages may be redelivered
6. **Dead Letters** - Configure DLQ for failed messages to avoid infinite retry loops

## Next Steps

- Learn about [Client Usage](/guide/client-usage)
- Explore [Defining Contracts](/guide/defining-contracts)
- Check out [Examples](/examples/)
