# Defining Contracts

Learn how to define AMQP contracts with full type safety.

## Contract Structure

A contract consists of five main parts:

```typescript
const contract = defineContract({
  exchanges: { /* ... */ },
  queues: { /* ... */ },
  bindings: { /* ... */ },
  publishers: { /* ... */ },
  consumers: { /* ... */ },
});
```

## Defining Exchanges

Exchanges route messages to queues:

```typescript
import { defineExchange } from '@amqp-contract/contract';

const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', {
      durable: true,
      autoDelete: false,
    }),
    notifications: defineExchange('notifications', 'fanout', {
      durable: true,
    }),
  },
});
```

**Exchange Types:**
- `direct` - Routes based on exact routing key match
- `topic` - Routes based on routing key patterns
- `fanout` - Routes to all bound queues
- `headers` - Routes based on message headers

## Defining Queues

Queues store messages:

```typescript
import { defineQueue } from '@amqp-contract/contract';

const contract = defineContract({
  queues: {
    orderProcessing: defineQueue('order-processing', {
      durable: true,       // Survives broker restart
      exclusive: false,    // Can be accessed by other connections
      autoDelete: false,   // Don't delete when last consumer disconnects
    }),
  },
});
```

## Defining Bindings

Bindings connect queues to exchanges:

```typescript
import { defineBinding } from '@amqp-contract/contract';

const contract = defineContract({
  bindings: {
    orderBinding: defineBinding('order-processing', 'orders', {
      routingKey: 'order.created',
    }),
    // Topic exchange with pattern
    allOrdersBinding: defineBinding('all-orders', 'orders', {
      routingKey: 'order.*',
    }),
  },
});
```

## Defining Publishers

Publishers define message schemas for publishing:

```typescript
import { definePublisher } from '@amqp-contract/contract';
import { z } from 'zod';

const contract = defineContract({
  publishers: {
    orderCreated: definePublisher(
      'orders',  // exchange name
      z.object({
        orderId: z.string().uuid(),
        customerId: z.string().uuid(),
        amount: z.number().positive(),
        createdAt: z.string().datetime(),
      }),
      {
        routingKey: 'order.created',
      }
    ),
  },
});
```

## Defining Consumers

Consumers define message schemas for consuming:

```typescript
import { defineConsumer } from '@amqp-contract/contract';
import { z } from 'zod';

const contract = defineContract({
  consumers: {
    processOrder: defineConsumer(
      'order-processing',  // queue name
      z.object({
        orderId: z.string().uuid(),
        customerId: z.string().uuid(),
        amount: z.number().positive(),
        createdAt: z.string().datetime(),
      }),
      {
        prefetch: 10,   // Max unacked messages
        noAck: false,   // Require acknowledgment
      }
    ),
  },
});
```

## Complete Example

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineBinding,
  definePublisher,
  defineConsumer,
} from '@amqp-contract/contract';
import { z } from 'zod';

export const orderContract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
    orderNotifications: defineQueue('order-notifications', { durable: true }),
  },
  bindings: {
    processingBinding: defineBinding('order-processing', 'orders', {
      routingKey: 'order.created',
    }),
    notificationBinding: defineBinding('order-notifications', 'orders', {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher(
      'orders',
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        amount: z.number(),
      }),
      { routingKey: 'order.created' }
    ),
  },
  consumers: {
    processOrder: defineConsumer(
      'order-processing',
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        amount: z.number(),
      })
    ),
    notifyOrder: defineConsumer(
      'order-notifications',
      z.object({
        orderId: z.string(),
        customerId: z.string(),
        amount: z.number(),
      })
    ),
  },
});
```

## Next Steps

- Learn about [Client Usage](/guide/client-usage)
- Understand [Worker Usage](/guide/worker-usage)
