# Worker Usage

Learn how to use the type-safe AMQP worker to consume messages.

::: tip NestJS Users
If you're building a NestJS application, check out the [NestJS Worker Usage](/guide/worker-nestjs-usage) guide for automatic lifecycle management and dependency injection.
:::

## Installation

Install the required packages:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/worker
```

```bash [npm]
npm install @amqp-contract/worker
```

```bash [yarn]
yarn add @amqp-contract/worker
```

:::

## Creating a Worker

Create a type-safe worker with message handlers. The worker automatically connects to RabbitMQ and starts consuming all messages:

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

// Create worker with handlers (automatically connects and starts consuming)
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);
      // Your business logic here
    },
    notifyOrder: async (message) => {
      console.log('Sending notification for:', message.orderId);
    },
  },
  connection: 'amqp://localhost',
});
```

## Message Handlers

Each handler receives validated, fully-typed messages:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // message is typed based on the consumer schema
      console.log(message.orderId);       // string
      console.log(message.amount);        // number
      console.log(message.items);         // array

      // Full autocomplete and type checking
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

- ✅ **Required handlers** - All consumers in the contract must have handlers
- ✅ **Message schema** - Messages are validated with Zod before reaching handlers
- ✅ **Type inference** - Handler parameters are fully typed

```typescript
// ❌ TypeScript error: missing handler for 'processOrder'
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    // notifyOrder is defined, but processOrder is missing
    notifyOrder: async (message) => { ... },
  },
  connection,
});

// ✅ All handlers present
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
    notifyOrder: async (message) => { ... },
  },
  connection,
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
      console.log('Processing:', message.orderId);
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
        // Your business logic
        await processOrder(message);

        // Explicitly acknowledge
        ack();
      } catch (error) {
        // Reject and requeue
        nack({ requeue: true });
      }
    },
  },
  connection,
});
```

### Acknowledgment Options

```typescript
// Acknowledge (default)
ack();

// Negative acknowledge (requeue)
nack({ requeue: true });

// Negative acknowledge (don't requeue)
nack({ requeue: false });

// Reject message
reject({ requeue: false });
```

## Error Handling

### Handler Errors

Errors in handlers are caught and logged:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      if (!message.items.length) {
        throw new Error('No items in order');
      }
      // Process order...
    },
  },
  connection,
});

// Errors are logged but don't crash the worker
```

### Connection Errors

Handle connection issues:

```typescript
connection.on('error', (error) => {
  console.error('Connection error:', error);
});

connection.on('close', () => {
  console.log('Connection closed');
  // Implement reconnection logic
});
```

## Consumer Options

Configure consumer behavior in the contract:

```typescript
const contract = defineContract({
  consumers: {
    processOrder: defineConsumer(
      'order-processing',
      orderSchema,
      {
        prefetch: 10,        // Process up to 10 messages concurrently
        noAck: false,        // Require explicit acknowledgment
        exclusive: false,    // Allow multiple consumers
      }
    ),
  },
});
```

## Graceful Shutdown

Properly close the worker on shutdown:

```typescript
async function shutdown() {
  console.log('Shutting down...');

  // Stop consuming new messages
  await worker.close();

  // Close the connection
  await connection.close();

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Advanced Usage

### Multiple Workers

Run multiple workers for different consumers:

```typescript
const processingWorker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
  },
  connection: connection1,
});

const notificationWorker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    notifyOrder: async (message) => { ... },
  },
  connection: connection2,
});
```

### Dead Letter Queues

Configure dead letter handling in queues:

```typescript
const contract = defineContract({
  queues: {
    orderProcessing: defineQueue('order-processing', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'order-dlx',
        'x-dead-letter-routing-key': 'order-dead',
      },
    }),
  },
});
```

### Retry Logic

Implement custom retry logic with requeuing:

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
        // For more sophisticated retry logic, use dead letter queues
        // with TTL and message headers to track retry count
        nack({ requeue: true });
      }
    },
  },
  connection,
});
```

**Note:** For production-grade retry logic with retry counting, configure [Dead Letter Queues](#dead-letter-queues) with message TTL and use a separate retry exchange to track attempts.

## Complete Example

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

async function main() {
  // Create worker with handlers (automatically connects and starts consuming)
  const worker = await TypedAmqpWorker.create({
    contract,
    handlers: {
      processOrder: async (message, { ack, nack }) => {
        try {
          console.log(`Processing order ${message.orderId}`);

          // Your business logic
          await saveToDatabase(message);
          await sendConfirmation(message.customerId);

          // Acknowledge success
          ack();
        } catch (error) {
          console.error('Processing failed:', error);
          nack({ requeue: true });
        }
      },

      notifyOrder: async (message) => {
        console.log(`Sending notification for ${message.orderId}`);
        await sendEmail(message);
      },
    },
    connection: 'amqp://localhost',
  });

  console.log('Worker ready, waiting for messages...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await worker.close(); // Closes worker, channel, and connection
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(console.error);
```

## Best Practices

1. **Handle Errors** - Always wrap business logic in try-catch
2. **Use Prefetch** - Limit concurrent message processing
3. **Graceful Shutdown** - Properly close connections on shutdown
4. **Idempotency** - Handlers should be safe to retry
5. **Logging** - Log message processing for debugging
6. **Dead Letters** - Configure DLQ for failed messages
7. **Monitoring** - Track message processing metrics

## Next Steps

- Learn about [Client Usage](/guide/client-usage) for publishing messages
- Explore [Defining Contracts](/guide/defining-contracts)
- See [Examples](/examples/) for complete implementations
