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
// Define once
const contract = defineContract({
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
      amount: z.number(),
    })),
  },
});

// Client knows the exact shape
// connection is an amqplib Connection object
const client = await createClient({ contract, connection });
await client.publish('orderCreated', {
  orderId: 'ORD-123',  // ✅ TypeScript knows this field
  amount: 99.99,        // ✅ TypeScript knows this field
  // invalid: true,     // ❌ TypeScript error!
});

// Worker handlers are fully typed
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      message.orderId;  // ✅ string (autocomplete works!)
      message.amount;   // ✅ number
    },
  },
  connection,
});
```

## Validation

Messages are automatically validated at network boundaries:

- **On publish**: Client validates before sending
- **On consume**: Worker validates before calling your handler

Invalid messages are rejected with clear error messages.

```typescript
import { createClient } from '@amqp-contract/client';
import { connect } from 'amqplib';

// Assuming contract is defined earlier
const connection = await connect('amqp://localhost');

// This will throw a validation error:
const client = await createClient({ contract, connection });
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 'not-a-number',  // ❌ Validation error!
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

// All of these work:
definePublisher('orders', z.object({ orderId: z.string() }));
definePublisher('orders', v.object({ orderId: v.string() }));
definePublisher('orders', type({ orderId: 'string' }));
```

## AMQP Resources

### Exchanges

Exchanges receive messages and route them to queues:

```typescript
defineExchange(
  'orders',      // name
  'topic',       // type: direct, fanout, topic, headers
  { durable: true }  // options
);
```

### Queues

Queues store messages until they're consumed:

```typescript
defineQueue(
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
defineBinding(
  'order-processing',  // queue
  'orders',           // exchange
  {
    routingKey: 'order.created',  // route messages with this key
  }
);
```

### Publishers

Publishers define message schemas for publishing:

```typescript
definePublisher(
  'orders',           // exchange
  z.object({         // message schema
    orderId: z.string(),
    amount: z.number(),
  }),
  {
    routingKey: 'order.created',  // routing key
  }
);
```

### Consumers

Consumers define message schemas for consuming:

```typescript
defineConsumer(
  'order-processing',  // queue
  z.object({          // message schema
    orderId: z.string(),
    amount: z.number(),
  }),
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
