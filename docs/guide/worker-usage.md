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

const worker = await TypedAmqpWorker.create({
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
}).resultToPromise();

console.log("✅ Worker ready!");
```

The worker automatically connects and starts consuming messages from all queues.

## Message Handlers

Handlers receive validated, fully-typed messages:

```typescript
const worker = await TypedAmqpWorker.create({
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
}).resultToPromise();
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
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
    notifyOrder: async (message) => { ... },
  },
  urls: ['amqp://localhost'],
}).resultToPromise();

console.log('✅ All handlers present');
```

## Defining Handlers Externally

For better organization, define handlers separately. The library provides two types of handlers:

### Safe Handlers (Recommended)

Safe handlers return `Future<Result<void, HandlerError>>` for explicit error handling:

```typescript
import { defineHandler, RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";
import { contract } from "./contract";

const processOrderHandler = defineHandler(contract, "processOrder", (message) =>
  Future.fromPromise(saveToDatabase(message))
    .mapOk(() => undefined)
    .mapError((error) => new RetryableError("Database error", error)),
);

// Non-retryable errors go directly to DLQ
const validateOrderHandler = defineHandler(contract, "validateOrder", (message) => {
  if (message.amount <= 0) {
    return Future.value(Result.Error(new NonRetryableError("Invalid order amount")));
  }
  return Future.value(Result.Ok(undefined));
});
```

### Unsafe Handlers (Legacy)

For simpler use cases or migration from existing code, use unsafe handlers that return `Promise<void>`:

```typescript
import { defineUnsafeHandler } from "@amqp-contract/worker";
import { contract } from "./contract";

const processOrderHandler = defineUnsafeHandler(contract, "processOrder", async (message) => {
  console.log("Processing:", message.orderId);
  await saveToDatabase(message);
  // Throws on error - will be retried (when retry is configured)
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
import { defineHandlers, RetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";
import { contract } from "./contract";

// Safe handlers (recommended) - for async operations use Future.fromPromise
const handlers = defineHandlers(contract, {
  processOrder: (message) =>
    Future.fromPromise(processPayment(message))
      .mapOk(() => undefined)
      .mapError((error) => new RetryableError("Payment failed", error)),
  notifyOrder: (message) =>
    Future.fromPromise(sendEmail(message))
      .mapOk(() => undefined)
      .mapError((error) => new RetryableError("Email failed", error)),
});

// Or use unsafe handlers for simpler code
import { defineUnsafeHandlers } from "@amqp-contract/worker";

const unsafeHandlers = defineUnsafeHandlers(contract, {
  processOrder: async (message) => {
    await processPayment(message);
  },
  notifyOrder: async (message) => {
    await sendEmail(message);
  },
});

const worker = await TypedAmqpWorker.create({
  contract,
  handlers, // or unsafeHandlers
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
- **Explicit Error Control**: Safe handlers force explicit error handling

### Example: Organized Handler Module (Safe Handlers)

Create a dedicated module for handlers with explicit error handling:

```typescript
// handlers/order-handlers.ts
import { defineHandler, defineHandlers, RetryableError } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";
import { orderContract } from "../contract";
import { processPayment } from "../services/payment";
import { sendEmail } from "../services/email";

export const processOrderHandler = defineHandler(orderContract, "processOrder", (message) =>
  Future.fromPromise(processPayment(message))
    .mapOk(() => undefined)
    .mapError((error) => new RetryableError("Payment failed", error)),
);

export const notifyOrderHandler = defineHandler(orderContract, "notifyOrder", (message) =>
  Future.fromPromise(sendEmail(message))
    .mapOk(() => undefined)
    .mapError((error) => new RetryableError("Email failed", error)),
);

// Export all handlers together
export const orderHandlers = defineHandlers(orderContract, {
  processOrder: processOrderHandler,
  notifyOrder: notifyOrderHandler,
});
```

### Example: Organized Handler Module (Unsafe Handlers)

For simpler use cases, use unsafe handlers:

```typescript
// handlers/order-handlers.ts
import { defineUnsafeHandler, defineUnsafeHandlers } from "@amqp-contract/worker";
import { orderContract } from "../contract";
import { processPayment } from "../services/payment";
import { sendEmail } from "../services/email";

export const processOrderHandler = defineUnsafeHandler(
  orderContract,
  "processOrder",
  async (message) => {
    await processPayment(message);
  },
);

export const notifyOrderHandler = defineUnsafeHandler(
  orderContract,
  "notifyOrder",
  async (message) => {
    await sendEmail(message);
  },
);

// Export all handlers together
export const orderHandlers = defineUnsafeHandlers(orderContract, {
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
const worker = await TypedAmqpWorker.create({
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
}).resultToPromise();
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

## Error Handling and Retry

The worker supports automatic retry with two different strategies:

1. **TTL-Backoff Mode** (default) - Uses TTL + wait queue pattern for exponential backoff
2. **Quorum-Native Mode** - Uses quorum queue's native `x-delivery-limit` feature for simpler retries

### Retry Strategies {#retry-strategies}

#### TTL-Backoff Mode (Default)

This mode provides exponential backoff using RabbitMQ's TTL and Dead Letter Exchange (DLX) pattern:

```typescript
import { TypedAmqpWorker } from "@amqp-contract/worker";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      await processPayment(message);
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    mode: "ttl-backoff", // This is the default
    maxRetries: 3, // Maximum retry attempts (default: 3)
    initialDelayMs: 1000, // Initial delay before first retry (default: 1000ms)
    maxDelayMs: 30000, // Maximum delay between retries (default: 30000ms)
    backoffMultiplier: 2, // Exponential backoff multiplier (default: 2)
    jitter: true, // Add random jitter to prevent thundering herd (default: true)
  },
}).resultToPromise();
```

**How TTL-Backoff works:**

1. **Message is acknowledged** - The worker acks the original message
2. **Published to wait queue** - Message is republished to a wait queue with a TTL
3. **Wait in queue** - Message sits in the wait queue for the calculated delay
4. **Dead-lettered back** - After TTL expires, message is automatically routed back to the main queue
5. **Retry processing** - Worker processes the message again
6. **Repeat or DLQ** - Process repeats until success or max retries reached, then sent to Dead Letter Queue (DLQ)

**Best for:** When you need configurable delays between retries to give downstream services time to recover.

**Limitation:** Potential head-of-queue blocking when messages have mixed TTLs (messages with shorter TTLs behind messages with longer TTLs won't expire until the longer ones do).

#### Quorum-Native Mode

A simpler mode that leverages RabbitMQ quorum queue's native `x-delivery-limit` feature:

```typescript
import { defineQueue, defineExchange } from "@amqp-contract/contract";

// 1. Define queue with deliveryLimit
const dlx = defineExchange("orders-dlx", "topic", { durable: true });
const ordersQueue = defineQueue("orders", {
  type: "quorum", // Default queue type
  deliveryLimit: 3, // After 3 delivery attempts, dead-letter
  deadLetter: {
    exchange: dlx,
    routingKey: "orders.failed",
  },
});

// 2. Configure worker with quorum-native mode
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      await processPayment(message);
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    mode: "quorum-native", // Use quorum queue's native delivery limit
  },
}).resultToPromise();
```

**How Quorum-Native works:**

1. When a handler fails, the message is nacked with `requeue=true`
2. RabbitMQ automatically tracks delivery count via `x-delivery-count` header
3. When count exceeds `deliveryLimit`, message is automatically dead-lettered
4. No wait queues or TTL management needed

**Best for:**

- Simpler architecture requirements
- When immediate retries are acceptable
- Avoiding head-of-queue blocking issues

**Limitation:** No exponential backoff — retries are immediate.

#### Comparing Retry Modes

| Feature                   | TTL-Backoff                      | Quorum-Native             |
| ------------------------- | -------------------------------- | ------------------------- |
| Retry delays              | Configurable exponential backoff | Immediate                 |
| Architecture              | Wait queues + DLX                | Native RabbitMQ           |
| Head-of-queue blocking    | Possible with mixed TTLs         | None                      |
| Delivery tracking         | Custom `x-retry-count` header    | Native `x-delivery-count` |
| Queue type                | Any                              | Quorum only               |
| Max retries configured in | Worker options                   | Queue's `deliveryLimit`   |

### Basic Retry Configuration

Enable retry by providing a `retry` configuration when creating the worker:

```typescript
import { TypedAmqpWorker, RetryableError } from "@amqp-contract/worker";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      try {
        await processPayment(message);
      } catch (error) {
        // Throw to trigger retry
        throw new Error("Payment processing failed");
      }
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3, // Maximum retry attempts (default: 3)
    initialDelayMs: 1000, // Initial delay before first retry (default: 1000ms)
    maxDelayMs: 30000, // Maximum delay between retries (default: 30000ms)
    backoffMultiplier: 2, // Exponential backoff multiplier (default: 2)
    jitter: true, // Add random jitter to prevent thundering herd (default: true)
  },
}).resultToPromise();
```

### How TTL-Backoff Retry Works

When retry is configured (with default `ttl-backoff` mode) and a handler throws an error:

1. **Message is acknowledged** - The worker acks the original message
2. **Published to wait queue** - Message is republished to a wait queue with a TTL
3. **Wait in queue** - Message sits in the wait queue for the calculated delay
4. **Dead-lettered back** - After TTL expires, message is automatically routed back to the main queue
5. **Retry processing** - Worker processes the message again
6. **Repeat or DLQ** - Process repeats until success or max retries reached, then sent to Dead Letter Queue (DLQ)

This approach uses native RabbitMQ features and doesn't block the consumer during retry delays.

### Exponential Backoff

Retry delays increase exponentially to give downstream services time to recover:

```typescript
// With default settings (initialDelayMs: 1000, backoffMultiplier: 2):
// Attempt 1: 1000ms delay
// Attempt 2: 2000ms delay
// Attempt 3: 4000ms delay
// After 3 attempts: Message sent to DLQ
```

**With jitter enabled** (default), a random factor (50-100% of calculated delay) is added to prevent all retried messages from hitting the system simultaneously.

### Queue Configuration for Retry

For retry to work, your queues must be configured with a Dead Letter Exchange (DLX):

```typescript
import { defineQueue, defineExchange } from "@amqp-contract/contract";

// Define the Dead Letter Exchange
const dlxExchange = defineExchange("orders-dlx", "topic", { durable: true });

// Define the Dead Letter Queue
const dlq = defineQueue("orders-dlq", { durable: true });

// Define your main queue with deadLetter configuration
const ordersQueue = defineQueue("orders", {
  durable: true,
  deadLetter: {
    exchange: dlxExchange,
    routingKey: "orders.failed",
  },
});

// Bind the DLQ to the DLX
const contract = defineContract({
  exchanges: {
    main: mainExchange,
    dlx: dlxExchange,
  },
  queues: {
    orders: ordersQueue,
    ordersDlq: dlq,
  },
  bindings: {
    // ... main queue bindings
    dlqBinding: defineQueueBinding(dlq, dlxExchange, {
      routingKey: "orders.failed",
    }),
  },
  // ... rest of contract
});
```

::: warning Queue DLX Required
If retry is enabled but a queue doesn't have `deadLetter` configured, the worker will log a warning and fall back to immediate requeue (legacy behavior). For proper retry functionality, always configure DLX on your queues.
:::

### Legacy Behavior (No Retry)

If you don't provide a `retry` configuration, the worker uses the legacy behavior:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // If this throws, message is immediately requeued
      await processPayment(message);
    },
  },
  urls: ["amqp://localhost"],
  // No retry config - uses legacy immediate requeue
}).resultToPromise();
```

**Legacy behavior:**

- Messages that fail are immediately requeued
- No delay between retries
- No automatic DLQ routing after max attempts
- Can lead to rapid retry loops

::: tip Migration from Legacy
If you're upgrading from the legacy behavior, add the `retry` configuration and ensure your queues have DLX configured. The worker will automatically handle the rest.
:::

### Retry Error Classes

The library provides two error classes for explicit error signaling:

#### RetryableError

Use `RetryableError` for transient failures that may succeed on retry:

```typescript
import { RetryableError, defineUnsafeHandler } from "@amqp-contract/worker";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: defineUnsafeHandler(contract, "processOrder", async (message) => {
      try {
        await externalApiCall(message);
      } catch (error) {
        // Explicitly signal this should be retried
        throw new RetryableError("External API temporarily unavailable", error);
      }
    }),
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 5,
    initialDelayMs: 2000,
  },
}).resultToPromise();
```

#### NonRetryableError

Use `NonRetryableError` for permanent failures that should NOT be retried:

```typescript
import { NonRetryableError, defineUnsafeHandler } from "@amqp-contract/worker";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: defineUnsafeHandler(contract, "processOrder", async (message) => {
      // Validation errors should not be retried
      if (message.amount <= 0) {
        throw new NonRetryableError("Invalid order amount");
      }
      await processPayment(message);
    }),
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 5,
    initialDelayMs: 2000,
  },
}).resultToPromise();
```

**NonRetryableError behavior:**

- Message is immediately sent to DLQ (if configured)
- No retry attempts are made
- Use for validation errors, business rule violations, or permanent failures

#### Using Safe Handlers for Better Error Control

For the most explicit error handling, use safe handlers that return `Future<Result>`:

```typescript
import { defineHandler, RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";
import { match } from "ts-pattern";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: defineHandler(contract, "processOrder", (message) => {
      // Validation - non-retryable
      if (message.amount <= 0) {
        return Future.value(Result.Error(new NonRetryableError("Invalid amount")));
      }

      return Future.fromPromise(processPayment(message))
        .mapOk(() => undefined)
        .mapError((error) =>
          match(error)
            .when(
              (e) => e instanceof PaymentDeclinedError,
              () => new NonRetryableError("Payment declined", error),
            )
            .otherwise(() => new RetryableError("Payment failed", error)),
        );
    }),
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 5,
    initialDelayMs: 2000,
  },
}).resultToPromise();
```

**When to use which error type:**

| Error Type                        | Use Case                                        | Behavior           |
| --------------------------------- | ----------------------------------------------- | ------------------ |
| `RetryableError`                  | Transient failures (network, rate limits)       | Retry with backoff |
| `NonRetryableError`               | Permanent failures (validation, business rules) | Immediate DLQ      |
| Any other error (unsafe handlers) | Unexpected failures                             | Retry with backoff |

**Note:** When using unsafe handlers with retry configured, **all errors except `NonRetryableError` are retried by default**.

### Retry with Batch Processing

Retry works with batch processing. If a batch handler throws an error, all messages in the batch are retried:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrders: [
      async (messages) => {
        try {
          await db.orders.insertMany(messages);
        } catch (error) {
          // All messages in batch will be retried
          throw new Error("Batch insert failed");
        }
      },
      { batchSize: 10, batchTimeout: 1000 },
    ],
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
  },
}).resultToPromise();
```

::: warning Batch Retry Behavior
All messages in a failed batch are treated the same way - they all get the same retry count and delay. For partial batch success handling, consider processing messages individually instead.
:::

### Monitoring Retry Headers

The worker adds headers to track retry information:

- `x-retry-count` - Number of times this message has been retried
- `x-last-error` - Error message from the last failed attempt
- `x-first-failure-timestamp` - Timestamp of the first failure

These headers can be useful for monitoring and debugging:

```typescript
// Example: Log retry information (requires custom message access)
// Note: Standard handlers don't expose raw message properties
// This is for illustration of what the worker tracks internally
```

### Best Practices for Retry

1. **Configure appropriate delays** - Start with 1-2 seconds, max out at 30-60 seconds
2. **Use jitter** - Keep jitter enabled (default) to prevent thundering herd
3. **Set reasonable max retries** - 3-5 retries is usually sufficient
4. **Configure DLX on all queues** - Ensures proper retry behavior and DLQ routing
5. **Make handlers idempotent** - Messages may be processed multiple times
6. **Monitor DLQ** - Set up alerts for messages reaching the DLQ
7. **Handle transient vs permanent failures** - Use retry for transient failures (network issues, rate limits), handle permanent failures (validation errors) before throwing

### Example: Complete Retry Setup

```typescript
import { TypedAmqpWorker, RetryableError } from "@amqp-contract/worker";
import {
  defineContract,
  defineQueue,
  defineExchange,
  defineQueueBinding,
} from "@amqp-contract/contract";

// Define contract with DLX
const dlxExchange = defineExchange("orders-dlx", "topic", { durable: true });
const ordersQueue = defineQueue("orders", {
  durable: true,
  deadLetter: {
    exchange: dlxExchange,
    routingKey: "orders.failed",
  },
});
const dlq = defineQueue("orders-dlq", { durable: true });

const contract = defineContract({
  exchanges: {
    main: mainExchange,
    dlx: dlxExchange,
  },
  queues: {
    orders: ordersQueue,
    ordersDlq: dlq,
  },
  bindings: {
    mainBinding: defineQueueBinding(ordersQueue, mainExchange, {
      routingKey: "order.#",
    }),
    dlqBinding: defineQueueBinding(dlq, dlxExchange, {
      routingKey: "orders.failed",
    }),
  },
  consumers: {
    processOrder: defineConsumer(ordersQueue, orderMessage),
  },
  // ... rest of contract
});

// Create worker with retry
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      try {
        // Validate before processing (don't retry validation errors)
        if (!message.amount || message.amount <= 0) {
          throw new Error("Invalid order amount");
        }

        // Process with external service (retry on failure)
        await paymentService.charge(message);
        await inventoryService.reserve(message);
        await notificationService.send(message);
      } catch (error) {
        // All errors will be retried
        console.error("Order processing failed:", error);
        throw error;
      }
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },
}).resultToPromise();

console.log("✅ Worker ready with retry enabled!");
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
