# @amqp-contract/worker

Type-safe AMQP worker for consuming messages.

## Installation

```bash
pnpm add @amqp-contract/worker amqplib
```

## Main Exports

### `createWorker`

Creates a type-safe AMQP worker from a contract with message handlers.

**Signature:**

```typescript
function createWorker<TContract>(
  contract: TContract,
  handlers: Handlers<TContract>
): AmqpWorker<TContract>
```

**Example:**

```typescript
import { createWorker } from '@amqp-contract/worker';
import { contract } from './contract';

const worker = createWorker(contract, {
  processOrder: async (message) => {
    console.log('Processing:', message.orderId);
  },
});
```

**Parameters:**

- `contract` - Contract definition created with `defineContract`
- `handlers` - Object with handler functions for each consumer

**Returns:** Type-safe AMQP worker

---

## AmqpWorker API

### `connect`

Connects the worker to RabbitMQ.

**Signature:**

```typescript
async connect(connection: Connection): Promise<void>
```

**Example:**

```typescript
import { connect } from 'amqplib';

const connection = await connect('amqp://localhost');
await worker.connect(connection);
```

**Parameters:**

- `connection` - amqplib Connection object

---

### `consumeAll`

Starts consuming from all queues defined in the contract.

**Signature:**

```typescript
async consumeAll(): Promise<void>
```

**Example:**

```typescript
await worker.consumeAll();
console.log('Worker ready, waiting for messages...');
```

---

### `consume`

Starts consuming from specific queues.

**Signature:**

```typescript
async consume(...consumers: Array<keyof Consumers>): Promise<void>
```

**Example:**

```typescript
// Consume from specific consumer
await worker.consume('processOrder');

// Consume from multiple consumers
await worker.consume('processOrder', 'notifyOrder');
```

**Parameters:**

- `...consumers` - Consumer names (from contract)

---

### `close`

Closes the worker and stops consuming.

**Signature:**

```typescript
async close(): Promise<void>
```

**Example:**

```typescript
await worker.close();
```

---

## Message Handlers

### Handler Signature

```typescript
type MessageHandler<TMessage> = (
  message: TMessage,
  context: HandlerContext
) => Promise<void> | void
```

### HandlerContext

The handler context provides message acknowledgment functions:

```typescript
interface HandlerContext {
  ack(): void;
  nack(options?: NackOptions): void;
  reject(options?: RejectOptions): void;
}
```

**Methods:**

- `ack()` - Acknowledge the message (mark as successfully processed)
- `nack(options)` - Negative acknowledge (reject with optional requeue)
  - `requeue` - Whether to requeue the message (default: `false`)
- `reject(options)` - Reject the message
  - `requeue` - Whether to requeue the message (default: `false`)

---

## Basic Example

```typescript
import { createWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

async function main() {
  // Connect to RabbitMQ
  const connection = await connect('amqp://localhost');

  // Create worker with handlers
  const worker = createWorker(contract, {
    processOrder: async (message) => {
      console.log(`Processing order ${message.orderId}`);
      console.log(`Customer: ${message.customerId}`);
      console.log(`Amount: $${message.amount}`);

      // Your business logic here
      await saveToDatabase(message);
    },

    notifyOrder: async (message) => {
      console.log(`Sending notification for ${message.orderId}`);
      await sendEmail(message);
    },
  });

  // Connect and start consuming
  await worker.connect(connection);
  await worker.consumeAll();

  console.log('Worker ready, waiting for messages...');
}

main();
```

## Manual Acknowledgment

```typescript
const worker = createWorker(contract, {
  processOrder: async (message, { ack, nack }) => {
    try {
      await processOrder(message);

      // Explicitly acknowledge
      ack();
    } catch (error) {
      console.error('Processing failed:', error);

      // Reject and requeue
      nack({ requeue: true });
    }
  },
});
```

## Error Handling

By default, errors in handlers are caught and logged:

```typescript
const worker = createWorker(contract, {
  processOrder: async (message) => {
    // If this throws, the message is NOT acknowledged
    // and remains in the queue
    await riskyOperation(message);
  },
});
```

With manual acknowledgment for better control:

```typescript
const worker = createWorker(contract, {
  processOrder: async (message, { ack, nack, reject }) => {
    try {
      await processOrder(message);
      ack();
    } catch (error) {
      if (isRetryable(error)) {
        // Requeue for retry
        nack({ requeue: true });
      } else {
        // Permanent failure, don't requeue
        nack({ requeue: false });
      }
    }
  },
});
```

## Selective Consumption

Start only specific consumers:

```typescript
// Start only the processing consumer
await worker.consume('processOrder');

// Start notification consumer later
setTimeout(() => {
  worker.consume('notifyOrder');
}, 5000);
```

## Graceful Shutdown

```typescript
async function shutdown() {
  console.log('Shutting down...');

  // Stop consuming new messages
  await worker.close();

  // Close connection
  await connection.close();

  console.log('Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Multiple Workers

Run multiple workers for different consumers:

```typescript
const processingWorker = createWorker(contract, {
  processOrder: async (message) => {
    // Heavy processing
    await processOrder(message);
  },
});

const notificationWorker = createWorker(contract, {
  notifyOrder: async (message) => {
    // Fast notifications
    await sendNotification(message);
  },
});

await processingWorker.connect(connection1);
await processingWorker.consumeAll();

await notificationWorker.connect(connection2);
await notificationWorker.consumeAll();
```

## Retry Logic

Implement custom retry logic with headers:

```typescript
const worker = createWorker(contract, {
  processOrder: async (message, { ack, nack }) => {
    const maxRetries = 3;
    const retryCount = message.properties?.headers?.['x-retry-count'] || 0;

    try {
      await processOrder(message);
      ack();
    } catch (error) {
      console.error(`Error (attempt ${retryCount + 1}):`, error);

      if (retryCount < maxRetries) {
        // Increment retry count and requeue
        // Note: You'll need to republish with updated headers
        nack({ requeue: false });
        // Republish logic here...
      } else {
        // Max retries exceeded
        console.error('Max retries exceeded, moving to DLQ');
        nack({ requeue: false });
      }
    }
  },
});
```

## Dead Letter Queues

Configure dead letter queues in your contract:

```typescript
const contract = defineContract({
  queues: {
    orderProcessing: defineQueue('order-processing', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'orders-dlx',
        'x-dead-letter-routing-key': 'orders-dead',
      },
    }),
  },
  // ... rest of contract
});
```

## Consumer Options

Configure consumer behavior in the contract:

```typescript
const contract = defineContract({
  consumers: {
    processOrder: defineConsumer('order-processing', orderSchema, {
      prefetch: 10,      // Process up to 10 messages concurrently
      noAck: false,      // Require explicit acknowledgment
      exclusive: false,  // Allow multiple consumers
    }),
  },
});
```

## Type Inference

The worker provides full type inference for consumer handlers:

```typescript
const worker = createWorker(contract, {
  processOrder: async (message) => {
    // message is fully typed based on the schema
    message.orderId;     // string
    message.amount;      // number
    message.items;       // array
  },

  // ❌ TypeScript error: missing required handler
  // notifyOrder: ...
});
```

## Complete Example

```typescript
import { createWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

async function main() {
  const connection = await connect('amqp://localhost');

  const worker = createWorker(contract, {
    processOrder: async (message, { ack, nack }) => {
      try {
        console.log(`[PROCESS] Order ${message.orderId}`);

        // Your business logic
        await saveToDatabase(message);
        await sendConfirmationEmail(message);

        ack();
        console.log(`[PROCESS] Order ${message.orderId} completed`);
      } catch (error) {
        console.error(`[PROCESS] Error:`, error);
        nack({ requeue: true });
      }
    },

    notifyOrder: async (message) => {
      console.log(`[NOTIFY] Order ${message.orderId} event`);
      await sendNotification(message);
    },
  });

  await worker.connect(connection);
  await worker.consumeAll();

  console.log('Worker ready, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await worker.close();
    await connection.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(console.error);
```

## See Also

- [Contract API](/api/contract) - Defining contracts
- [Client API](/api/client) - Publishing messages
- [Worker Usage Guide](/guide/worker-usage)
