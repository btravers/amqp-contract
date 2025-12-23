# Core Concepts

Understanding the core concepts of amqp-contract will help you use the library effectively.

## Contract-First Design

The foundation of amqp-contract is the **contract**. A contract defines:

- **Exchanges**: Where messages are published
- **Queues**: Where messages are stored
- **Bindings**: How queues are connected to exchanges
- **Publishers**: Message schemas for publishing
- **Consumers**: Message schemas for consuming

All of this is defined once, and type safety flows from there.

## Type Safety

amqp-contract provides end-to-end type safety:

```typescript
import { z } from 'zod';

// Define resources and message
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderMessage = defineMessage(z.object({
  orderId: z.string(),
  amount: z.number(),
}));

// Define once
const contract = defineContract({
  exchanges: { orders: ordersExchange },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
});

// Client knows the exact shape
const client = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://localhost'
});

const result = client.publish('orderCreated', {
  orderId: 'ORD-123',  // ✅ TypeScript knows this field
  amount: 99.99,        // ✅ TypeScript knows this field
  // invalid: true,     // ❌ TypeScript error!
});

// Handle errors explicitly using match pattern
result.match({
  Ok: (value) => console.log('Published:', value),
  Error: (error) => console.error('Failed:', error),
});

// Worker handlers are fully typed
const orderProcessingQueue = defineQueue('order-processing', { durable: true });
const workerContract = defineContract({
  queues: { orderProcessing: orderProcessingQueue },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});

const worker = await TypedAmqpWorker.create({
  contract: workerContract,
  handlers: {
    processOrder: async (message) => {
      message.orderId;  // ✅ string (autocomplete works!)
      message.amount;   // ✅ number
    },
  },
  connection: 'amqp://localhost',
});
```

## Validation

Messages are automatically validated at network boundaries:

- **On publish**: Client validates before sending and returns errors via `Result` type
- **On consume**: Worker validates before calling your handler

Invalid messages are rejected with clear error messages.

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { MessageValidationError } from '@amqp-contract/client';

const client = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://localhost'
});

// This will return a validation error (not throw):
const result = client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 'not-a-number',  // ❌ Validation error!
});

result.match({
  Ok: () => console.log('Published'),
  Error: (error) => {
    if (error instanceof MessageValidationError) {
      console.error('Validation failed:', error.issues);
    }
  },
});
```

## Schema Libraries

amqp-contract uses the [Standard Schema](https://github.com/standard-schema/standard-schema) spec, which means it works with:

- ✅ [Zod](https://github.com/colinhacks/zod)
- ✅ [Valibot](https://valibot.dev/)
- ✅ [ArkType](https://arktype.io/)
- ✅ Any library that implements Standard Schema

Most examples use Zod, but you can use any compatible library:

```typescript
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';

const ordersExchange = defineExchange('orders', 'topic', { durable: true });

// All of these work:
definePublisher(ordersExchange, defineMessage(z.object({ orderId: z.string() })), {
  routingKey: 'order.created',
});
definePublisher(ordersExchange, defineMessage(v.object({ orderId: v.string() })), {
  routingKey: 'order.created',
});
definePublisher(ordersExchange, defineMessage(type({ orderId: 'string' })), {
  routingKey: 'order.created',
});
```

## AMQP Resources

### Exchanges

Exchanges receive messages and route them to queues:

```typescript
const ordersExchange = defineExchange(
  'orders',      // name
  'topic',       // type: direct, fanout, topic
  { durable: true }  // options
);
```

### Queues

Queues store messages until they're consumed:

```typescript
const orderProcessingQueue = defineQueue(
  'order-processing',  // name
  {
    durable: true,     // survives broker restart
    exclusive: false,  // can be accessed by other connections
  }
);
```

### Bindings

Bindings connect queues to exchanges:

```typescript
const orderBinding = defineQueueBinding(
  orderProcessingQueue,  // queue object
  ordersExchange,        // exchange object
  {
    routingKey: 'order.created',  // route messages with this key
  }
);
```

### Publishers

Publishers define message schemas for publishing:

```typescript
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  })
);

const orderCreatedPublisher = definePublisher(
  ordersExchange,    // exchange object
  orderMessage,      // message definition
  {
    routingKey: 'order.created',  // routing key
  }
);
```

### Consumers

Consumers define message schemas for consuming:

```typescript
const processOrderConsumer = defineConsumer(
  orderProcessingQueue,  // queue object
  orderMessage,          // message definition
  {
    prefetch: 10,     // max unacked messages
    noAck: false,     // require acknowledgment
  }
);
```

## Message Flow

Here's how messages flow through the system:

1. **Client publishes** a message
2. Message is **validated** against the schema
3. Message is sent to the **exchange**
4. Exchange routes to **queues** via **bindings**
5. **Worker consumes** from queue
6. Message is **validated** again
7. Handler is called with **typed message**
8. Message is **acknowledged**

All of this happens automatically with type safety and validation!

## Next Steps

- Learn about [Defining Contracts](/guide/defining-contracts)
- Explore [Client Usage](/guide/client-usage)
- Understand [Worker Usage](/guide/worker-usage)
