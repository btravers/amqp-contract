# @amqp-contract/worker

Type-safe AMQP worker for consuming messages.

## Installation

```bash
pnpm add @amqp-contract/worker amqplib
```

## Main Exports

### `createWorker`

Creates a type-safe AMQP worker from a contract with message handlers. Automatically connects to RabbitMQ and starts consuming all messages.

**Signature:**

```typescript
async function createWorker<TContract>(
  options: CreateWorkerOptions<TContract>
): Promise<AmqpWorker<TContract>>
```

**Example:**

```typescript
import { createWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

const connection = await connect('amqp://localhost');
const worker = await createWorker({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing:', message.orderId);
    },
  },
  connection,
});
```

**Parameters:**

- `options` - Configuration object:
  - `contract` - Contract definition created with `defineContract`
  - `handlers` - Object with handler functions for each consumer
  - `connection` - amqplib Connection object

**Returns:** Promise that resolves to a type-safe AMQP worker

---

## AmqpWorker API

### `connect`

Connects the worker to RabbitMQ.

**Note:** When using `createWorker()`, this method is called automatically. You only need to call this manually if you create an `AmqpWorker` instance directly using `new AmqpWorker()`.

**Signature:**

```typescript
async connect(connection: Connection): Promise<void>
```

**Example:**

```typescript
import { AmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';

const connection = await connect('amqp://localhost');
const worker = new AmqpWorker(contract, handlers);
await worker.connect(connection);
```

**Parameters:**

- `connection` - amqplib Connection object

---

### `consumeAll`

Starts consuming from all queues defined in the contract.

**Note:** When using `createWorker()`, this method is called automatically. You only need to call this manually if you create an `AmqpWorker` instance directly and want to start all consumers at once.

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

## Types

### `CreateWorkerOptions`

```typescript
interface CreateWorkerOptions<TContract> {
  contract: TContract;
  handlers: Handlers<TContract>;
  connection: Connection;
}
```

## Message Handlers

### Handler Signature

```typescript
type MessageHandler<TMessage> = (
  message: TMessage,
  context?: HandlerContext
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

  // Create worker with handlers (automatically connects and starts consuming)
  const worker = await createWorker({
    contract,
    handlers: {
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
    },
    connection,
  });

  console.log('Worker ready, waiting for messages...');
}

main();
```

## Manual Acknowledgment

```typescript
const worker = await createWorker({
  contract,
  handlers: {
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
  },
  connection,
});
```

## Error Handling

By default, errors in handlers are caught and logged:

```typescript
const worker = await createWorker({
  contract,
  handlers: {
    processOrder: async (message) => {
      // If this throws, the message is NOT acknowledged
      // and remains in the queue
      await riskyOperation(message);
    },
  },
  connection,
});
```

With manual acknowledgment for better control:

```typescript
const worker = await createWorker({
  contract,
  handlers: {
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
  },
  connection,
});
```

## Selective Consumption

If you need to start only specific consumers, use the `AmqpWorker` class directly:

```typescript
import { AmqpWorker } from '@amqp-contract/worker';

const worker = new AmqpWorker(contract, handlers);
await worker.connect(connection);

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
const processingWorker = await createWorker({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Heavy processing
      await processOrder(message);
    },
  },
  connection: connection1,
});

const notificationWorker = await createWorker({
  contract,
  handlers: {
    notifyOrder: async (message) => {
      // Fast notifications
      await sendNotification(message);
    },
  },
  connection: connection2,
});
```

## Retry Logic

Implement custom retry logic:

```typescript
const worker = await createWorker({
  contract,
  handlers: {
    processOrder: async (message, { ack, nack }) => {
      try {
        await processOrder(message);
        ack();
      } catch (error) {
        console.error('Processing failed:', error);

        // Requeue for retry (simple approach)
        // For sophisticated retry logic, use dead letter queues
        // with TTL to track retry attempts
        nack({ requeue: true });
      }
    },
  },
  connection,
});
```

**Note:** For production-grade retry logic with retry counting, configure [Dead Letter Queues](#dead-letter-queues) with message TTL and routing.

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
const worker = await createWorker({
  contract,
  handlers: {
    processOrder: async (message) => {
      // message is fully typed based on the schema
      message.orderId;     // string
      message.amount;      // number
      message.items;       // array
    },

    // ❌ TypeScript error: missing required handler
    // notifyOrder: ...
  },
  connection,
});
```

## Complete Example

```typescript
import { createWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

async function main() {
  const connection = await connect('amqp://localhost');

  const worker = await createWorker({
    contract,
    handlers: {
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
    },
    connection,
  });

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
