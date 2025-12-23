# @amqp-contract/worker

Type-safe AMQP worker for consuming messages.

## Installation

```bash
pnpm add @amqp-contract/worker
```

## Main Exports

### `TypedAmqpWorker.create`

Creates a type-safe AMQP worker from a contract with message handlers. Automatically connects to RabbitMQ and starts consuming all messages.

**Signature:**

```typescript
static async create<TContract>(
  options: CreateWorkerOptions<TContract>
): Promise<TypedAmqpWorker<TContract>>
```

**Example:**

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing:', message.orderId);
    },
  },
  connection: 'amqp://localhost',
});
```

**Parameters:**

- `options` - Configuration object:
  - `contract` - Contract definition created with `defineContract`
  - `handlers` - Object with handler functions for each consumer
  - `connection` - AMQP connection URL (string) or connection options (Options.Connect)

**Returns:** Promise that resolves to a type-safe AMQP worker

---

## TypedAmqpWorker API

### `close`

Closes the worker, stops consuming, and closes the connection.

**Signature:**

```typescript
async close(): Promise<void>
```

**Example:**

```typescript
await worker.close();
```

---

## Handler Definition Utilities

### `defineHandler`

Define a type-safe handler for a specific consumer in a contract. This utility allows you to define handlers outside of the worker creation for better code organization and reusability.

**Signature:**

```typescript
function defineHandler<TContract, TName>(
  contract: TContract,
  consumerName: TName,
  handler: WorkerInferConsumerHandler<TContract, TName>
): WorkerInferConsumerHandler<TContract, TName>
```

**Parameters:**

- `contract` - The contract definition containing the consumer
- `consumerName` - The name of the consumer from the contract
- `handler` - The async handler function that processes messages

**Returns:** Type-safe handler function with full type inference

**Example:**

```typescript
import { defineHandler } from '@amqp-contract/worker';
import { orderContract } from './contract';

// Define handler outside of worker creation
const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    // message is fully typed based on the contract
    console.log('Processing order:', message.orderId);
    await processPayment(message);
  }
);

// Use the handler in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
  },
  connection: 'amqp://localhost',
});
```

---

### `defineHandlers`

Define multiple type-safe handlers for consumers in a contract at once. This utility ensures type safety and validates that all consumers exist in the contract.

**Signature:**

```typescript
function defineHandlers<TContract>(
  contract: TContract,
  handlers: WorkerInferConsumerHandlers<TContract>
): WorkerInferConsumerHandlers<TContract>
```

**Parameters:**

- `contract` - The contract definition containing the consumers
- `handlers` - An object with async handler functions for each consumer

**Returns:** Type-safe handlers object with full type inference

**Example:**

```typescript
import { defineHandlers } from '@amqp-contract/worker';
import { orderContract } from './contract';

// Define all handlers at once
const handlers = defineHandlers(orderContract, {
  processOrder: async (message) => {
    console.log('Processing order:', message.orderId);
    await processPayment(message);
  },
  notifyOrder: async (message) => {
    await sendNotification(message);
  },
  shipOrder: async (message) => {
    await prepareShipment(message);
  },
});

// Use in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers,
  connection: 'amqp://localhost',
});
```

**Benefits:**

- **Better Organization**: Separate handler logic from worker setup
- **Reusability**: Share handlers across multiple workers or tests
- **Type Safety**: Full type checking at definition time
- **Testability**: Test handlers independently before integration

---

## Types

### `CreateWorkerOptions`

```typescript
interface CreateWorkerOptions<TContract> {
  contract: TContract;
  handlers: Handlers<TContract>;
  connection: string | Options.Connect;
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
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

async function main() {
  // Create worker with handlers (automatically connects and starts consuming)
  const worker = await TypedAmqpWorker.create({
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
    connection: 'amqp://localhost',
  });

  console.log('Worker ready, waiting for messages...');
}

main();
```

## Manual Acknowledgment

```typescript
const worker = await TypedAmqpWorker.create({
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
const worker = await TypedAmqpWorker.create({
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
const worker = await TypedAmqpWorker.create({
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
const processingWorker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Heavy processing
      await processOrder(message);
    },
  },
  connection: connection1,
});

const notificationWorker = await TypedAmqpWorker.create({
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
const worker = await TypedAmqpWorker.create({
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
const orderProcessingQueue = defineQueue('order-processing', { durable: true });
const orderMessage = defineMessage(orderSchema);

const contract = defineContract({
  queues: { orderProcessing: orderProcessingQueue },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage, {
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
const worker = await TypedAmqpWorker.create({
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
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

async function main() {
  const connection = await connect('amqp://localhost');

  const worker = await TypedAmqpWorker.create({
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
