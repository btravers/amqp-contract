# Defining Contracts

Learn how to define AMQP contracts with full type safety.

## Contract Structure

A contract has five main parts:

```typescript
const contract = defineContract({
  exchanges: { /* ... */ },
  queues: { /* ... */ },
  bindings: { /* ... */ },
  publishers: { /* ... */ },
  consumers: { /* ... */ },
});
```

## Composition Pattern

amqp-contract uses a **composition pattern**:

1. **Define resources first** - Create exchanges, queues, and messages as variables
2. **Reference objects** - Use these objects (not strings) in bindings, publishers, and consumers
3. **Compose together** - Combine everything in `defineContract`

**Benefits:**

- ✅ Better type safety - TypeScript validates exchange/queue types
- ✅ Better refactoring - Rename in one place
- ✅ DRY principle - Define once, reference many times

## Defining Exchanges

Exchanges route messages to queues:

```typescript
import { defineExchange } from '@amqp-contract/contract';

// Define exchanges as variables
const ordersExchange = defineExchange('orders', 'topic', {
  durable: true,
  autoDelete: false,
});

const notificationsExchange = defineExchange('notifications', 'fanout', {
  durable: true,
});

const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
    notifications: notificationsExchange,
  },
});
```

**Exchange Types:**

- `direct` - Routes by exact routing key match
- `topic` - Routes by routing key patterns (wildcards `*` and `#`)
- `fanout` - Routes to all bound queues (ignores routing keys)

## Defining Queues

Queues store messages:

```typescript
import { defineQueue } from '@amqp-contract/contract';

const orderProcessingQueue = defineQueue('order-processing', {
  durable: true,       // Survives broker restart
  exclusive: false,    // Can be accessed by other connections
  autoDelete: false,   // Stays after last consumer disconnects
});

const contract = defineContract({
  queues: {
    orderProcessing: orderProcessingQueue,
  },
});
```

## Defining Messages

Messages wrap schemas with optional metadata:

```typescript
import { defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number().positive(),
  }),
  {
    summary: 'Order created event',
    description: 'Emitted when a new order is created',
  }
);
```

**Benefits:**
- Enables AsyncAPI documentation
- Improves code readability
- Allows header schema definition

## Defining Bindings

Bindings connect queues to exchanges:

```typescript
import { defineQueueBinding } from '@amqp-contract/contract';

const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });
const allOrdersQueue = defineQueue('all-orders', { durable: true });

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: {
    orderProcessing: orderProcessingQueue,
    allOrders: allOrdersQueue,
  },
  bindings: {
    // Exact routing key
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
    // Wildcard pattern
    allOrdersBinding: defineQueueBinding(allOrdersQueue, ordersExchange, {
      routingKey: 'order.*',
    }),
  },
});
```

**Routing Key Requirements:**
- **Fanout**: Routing key is optional (fanout ignores it)
- **Direct/Topic**: Routing key is required

TypeScript enforces these rules at compile time!

## Defining Publishers

Publishers define message schemas for publishing:

```typescript
import { definePublisher, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

const ordersExchange = defineExchange('orders', 'topic', { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
    createdAt: z.string().datetime(),
  })
);

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
});
```

**Routing Key Requirements:**
- **Fanout**: Optional
- **Direct/Topic**: Required

## Defining Consumers

Consumers define message schemas for consuming:

```typescript
import { defineConsumer, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

const orderProcessingQueue = defineQueue('order-processing', { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
    createdAt: z.string().datetime(),
  })
);

const contract = defineContract({
  queues: { orderProcessing: orderProcessingQueue },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});
```

## Complete Example

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  definePublisher,
  defineConsumer,
  defineMessage,
} from '@amqp-contract/contract';
import { z } from 'zod';

// 1. Define exchanges
const ordersExchange = defineExchange('orders', 'topic', { durable: true });

// 2. Define queues
const orderProcessingQueue = defineQueue('order-processing', { durable: true });
const orderNotificationsQueue = defineQueue('order-notifications', { durable: true });

// 3. Define messages
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
  })
);

// 4. Compose contract
export const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
    orderNotifications: orderNotificationsQueue,
  },
  bindings: {
    processingBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
    notificationBinding: defineQueueBinding(orderNotificationsQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
    notifyOrder: defineConsumer(orderNotificationsQueue, orderMessage),
  },
});
```

## Exchange-to-Exchange Bindings

Bind exchanges together for advanced routing:

```typescript
import { defineExchangeBinding } from '@amqp-contract/contract';

const sourceExchange = defineExchange('source', 'topic', { durable: true });
const destExchange = defineExchange('destination', 'topic', { durable: true });

const contract = defineContract({
  exchanges: {
    source: sourceExchange,
    destination: destExchange,
  },
  bindings: {
    // Messages from source flow to destination
    crossExchange: defineExchangeBinding(destExchange, sourceExchange, {
      routingKey: 'order.#',
    }),
  },
});
```

## Next Steps

- Learn about [Client Usage](/guide/client-usage)
- Understand [Worker Usage](/guide/worker-usage)
