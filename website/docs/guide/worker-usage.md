# Worker Usage

Learn how to use the type-safe AMQP worker to consume messages.

::: tip NestJS Users
For NestJS applications, see the [NestJS Worker Usage](/guide/worker-nestjs-usage) guide.
:::

## Creating a Worker

Create a worker with type-safe message handlers:

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing:', message.orderId);
      // Your business logic here
    },
    notifyOrder: async (message) => {
      console.log('Notifying:', message.orderId);
    },
  },
  connection: 'amqp://localhost',
});

console.log('✅ Worker ready!');
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
      console.log(message.orderId);   // ✅ string
      console.log(message.amount);    // ✅ number
      console.log(message.items);     // ✅ array

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
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    notifyOrder: async (message) => { ... },
    // Missing processOrder handler!
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

## Defining Handlers Externally

For better organization, define handlers separately:

### Single Handler

```typescript
import { defineHandler } from '@amqp-contract/worker';
import { contract } from './contract';

const processOrderHandler = defineHandler(
  contract,
  'processOrder',
  async (message) => {
    console.log('Processing:', message.orderId);
    await saveToDatabase(message);
  }
);

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: processOrderHandler,
  },
  connection: 'amqp://localhost',
});
```

### Multiple Handlers

```typescript
import { defineHandlers } from '@amqp-contract/worker';
import { contract } from './contract';

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
  connection: 'amqp://localhost',
});
```

// Define all handlers together
const handlers = defineHandlers(orderContract, {
  processOrder: async (message) => {
    console.log('Processing order:', message.orderId);
    await processPayment(message);
  },

  notifyOrder: async (message) => {
    console.log('Sending notification for:', message.orderId);
    await sendEmail(message);
  },

  shipOrder: async (message) => {
    console.log('Preparing shipment for:', message.orderId);
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
import { defineHandler, defineHandlers } from '@amqp-contract/worker';
import { orderContract } from '../contract';
import { processPayment } from '../services/payment';
import { sendEmail } from '../services/email';

export const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    await processPayment(message);
  }
);

export const notifyOrderHandler = defineHandler(
  orderContract,
  'notifyOrder',
  async (message) => {
    await sendEmail(message);
  }
);

// Export all handlers together
export const orderHandlers = defineHandlers(orderContract, {
  processOrder: processOrderHandler,
  notifyOrder: notifyOrderHandler,
});
```

```typescript
// worker.ts
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { orderContract } from './contract';
import { orderHandlers } from './handlers/order-handlers';

const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: orderHandlers,
  connection: 'amqp://localhost',
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

## Message Acknowledgment

### Automatic Acknowledgment

By default, messages are automatically acknowledged:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing:', message.orderId);
      // Auto-acknowledged after handler completes
    },
  },
  connection,
});
```

### Manual Acknowledgment

For more control:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message, { ack, nack, reject }) => {
      try {
        await processOrder(message);
        ack();  // Acknowledge success
      } catch (error) {
        nack({ requeue: true });  // Requeue for retry
      }
    },
  },
  connection,
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
  console.log('Shutting down...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Complete Example

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

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

  console.log('✅ Worker ready!');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(console.error);
```

## Best Practices

1. **Handle Errors** - Always wrap business logic in try-catch
2. **Use Prefetch** - Limit concurrent messages with `prefetch` option
3. **Graceful Shutdown** - Properly close connections
4. **Idempotency** - Handlers should be safe to retry
5. **Dead Letters** - Configure DLQ for failed messages

## Next Steps

- Learn about [Client Usage](/guide/client-usage)
- Explore [Defining Contracts](/guide/defining-contracts)
- Check out [Examples](/examples/)
