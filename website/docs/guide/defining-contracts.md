# Defining Contracts

Learn how to define AMQP contracts with full type safety.

## Recommended Approach: Publisher-First and Consumer-First Patterns

::: tip RECOMMENDED
For robust contract definitions with guaranteed consistency, use **`definePublisherFirst`** (for events) or **`defineConsumerFirst`** (for commands). These patterns ensure message schema and routing key consistency between publishers and consumers.
:::

### Publisher-First Pattern (Event-Oriented)

Use this pattern for **events** where publishers don't need to know about queues. Multiple consumers can be created for different queues, all using the same message schema:

```typescript
import {
  definePublisherFirst,
  defineContract,
  defineExchange,
  defineQueue,
  defineMessage,
} from '@amqp-contract/contract';
import { z } from 'zod';

// Define exchange and message
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderMessage = defineMessage(z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
}));

// Publisher-first: creates publisher without knowing about queues
const orderCreatedEvent = definePublisherFirst(
  ordersExchange,
  orderMessage,
  { routingKey: 'order.created' }
);

// Multiple queues can consume the same event
const orderQueue = defineQueue('order-processing', { durable: true });
const analyticsQueue = defineQueue('analytics', { durable: true });

// Create consumers for each queue
const { consumer: processConsumer, binding: processBinding } =
  orderCreatedEvent.createConsumer(orderQueue);
const { consumer: analyticsConsumer, binding: analyticsBinding } =
  orderCreatedEvent.createConsumer(analyticsQueue);

// Compose contract
export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderQueue, analyticsQueue },
  bindings: {
    orderBinding: processBinding,      // Same routing key
    analyticsBinding: analyticsBinding, // Same routing key
  },
  publishers: {
    orderCreated: orderCreatedEvent.publisher,
  },
  consumers: {
    processOrder: processConsumer,      // Same message schema
    trackOrder: analyticsConsumer,      // Same message schema
  },
});
```

**Benefits:**

- ✅ Publishers don't need to know about queues (true event-oriented)
- ✅ Multiple consumers can subscribe to the same event
- ✅ Guaranteed message schema consistency
- ✅ Automatic routing key synchronization

#### Topic Exchange with Publisher-First

For topic exchanges, consumers can optionally override the routing key with their own binding patterns:

```typescript
// Publisher uses a concrete routing key
const orderCreatedEvent = definePublisherFirst(
  ordersExchange,  // topic exchange
  orderMessage,
  { routingKey: 'order.created' }
);

// Consumers can use different patterns or the default key
const { consumer: exactConsumer, binding: exactBinding } =
  orderCreatedEvent.createConsumer(exactMatchQueue);  // Uses 'order.created'

const { consumer: patternConsumer, binding: patternBinding } =
  orderCreatedEvent.createConsumer(allOrdersQueue, 'order.*');  // Uses pattern 'order.*'

export const contract = defineContract({
  // ...
  publishers: {
    orderCreated: orderCreatedEvent.publisher,
  },
  consumers: {
    processExactOrder: exactConsumer,      // Receives only 'order.created'
    processAllOrders: patternConsumer,     // Receives any 'order.*' messages
  },
});
```

**Pattern Matching:**
- `*` matches exactly one word (e.g., `order.*` matches `order.created` but not `order.item.shipped`)
- `#` matches zero or more words (e.g., `order.#` matches `order.created`, `order.item.shipped`, etc.)

### Consumer-First Pattern (Command-Oriented)

Use this pattern for **commands** where consumers define what they expect:

```typescript
import {
  defineConsumerFirst,
  defineContract,
  defineQueue,
  defineExchange,
  defineMessage,
} from '@amqp-contract/contract';
import { z } from 'zod';

// Define queue, exchange, and message
const taskQueue = defineQueue('tasks', { durable: true });
const tasksExchange = defineExchange('tasks', 'direct', { durable: true });
const taskMessage = defineMessage(z.object({
  taskId: z.string(),
  action: z.string(),
}));

// Consumer-first: defines consumer expectations
const taskCommand = defineConsumerFirst(
  taskQueue,
  tasksExchange,
  taskMessage,
  { routingKey: 'task.execute' }
);

// Compose contract
export const contract = defineContract({
  exchanges: { tasks: tasksExchange },
  queues: { taskQueue },
  bindings: {
    taskBinding: taskCommand.binding, // Consistent routing key
  },
  publishers: {
    executeTask: taskCommand.createPublisher('task.execute'), // Matching schema & routing key
  },
  consumers: {
    processTask: taskCommand.consumer,
  },
});
```

**Benefits:**

- ✅ Consumer defines the contract (command pattern)
- ✅ Publishers automatically match consumer expectations
- ✅ Guaranteed message schema consistency
- ✅ Routing key type validation at compile time

#### Topic Exchange with Consumer-First

For topic exchanges, the consumer binding can use patterns with wildcards, and publishers can specify concrete routing keys that match the pattern:

```typescript
// Consumer binds with a pattern
const orderEventsCommand = defineConsumerFirst(
  orderQueue,
  ordersExchange,  // topic exchange
  orderMessage,
  { routingKey: 'order.*' }  // Pattern with wildcard
);

// Publishers can use concrete keys that match the pattern
export const contract = defineContract({
  // ...
  publishers: {
    orderCreated: orderEventsCommand.createPublisher('order.created'),  // Matches order.*
    orderUpdated: orderEventsCommand.createPublisher('order.updated'),  // Matches order.*
    orderShipped: orderEventsCommand.createPublisher('order.shipped'),  // Matches order.*
  },
  consumers: {
    processOrders: orderEventsCommand.consumer,
  },
});
```

**Pattern Matching:**
- `*` matches exactly one word (e.g., `order.*` matches `order.created` but not `order.item.shipped`)
- `#` matches zero or more words (e.g., `order.#` matches `order.created`, `order.item.shipped`, etc.)

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

Learn more about schema libraries:

- [Zod](https://zod.dev/)
- [Valibot](https://valibot.dev/)
- [ArkType](https://arktype.io/)

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

## When to Use Each Approach

### Use Publisher-First / Consumer-First (Recommended)

✅ **Use for most cases** - Provides consistency guarantees and prevents runtime errors

- Event-driven architectures (use `definePublisherFirst`)
- Command patterns (use `defineConsumerFirst`)
- When you want guaranteed message schema consistency
- When you want automatic routing key synchronization

### Use Basic Definition (Advanced)

Use the basic `definePublisher`, `defineConsumer`, `defineQueueBinding` approach only when:

- You need exchange-to-exchange bindings
- You're working with complex routing patterns that don't fit the event/command model
- You're integrating with existing AMQP infrastructure with specific requirements

::: warning
When using basic definitions, you must manually ensure:

- Publishers and consumers use the same message schemas
- Routing keys match between publishers and bindings
  :::

## Type Validation Utilities

amqp-contract exports advanced utility types for validating routing keys and binding patterns at compile time:

```typescript
import {
  RoutingKey,
  BindingPattern,
  MatchingRoutingKey,
} from '@amqp-contract/contract';

// Validate routing key format and character set
type ValidKey = RoutingKey<'order.created'>;  // ✅ 'order.created'
type InvalidKey = RoutingKey<'order..bad'>;   // ❌ never (empty segment)

// Validate binding pattern with wildcards
type ValidPattern = BindingPattern<'order.*'>;      // ✅ 'order.*'
type ValidHashPattern = BindingPattern<'order.#'>;  // ✅ 'order.#'
type InvalidPattern = BindingPattern<'order.!'>;    // ❌ never (invalid wildcard)

// Validate routing key matches a pattern
type OrderCreated = MatchingRoutingKey<'order.*', 'order.created'>;  // ✅ 'order.created'
type OrderShipped = MatchingRoutingKey<'order.*', 'order.shipped'>;  // ✅ 'order.shipped'
type InvalidMatch = MatchingRoutingKey<'order.*', 'user.created'>;   // ❌ never (doesn't match)
```

**Validation Rules:**

- **Character Set**: Only alphanumeric characters, hyphens (`-`), and underscores (`_`) allowed
- **Format**: Dot-separated segments (e.g., `order.created`, `user.login.success`)
- **Wildcards**: 
  - `*` matches exactly one word
  - `#` matches zero or more words
  - Only valid in binding patterns, not routing keys

These types are used internally by `definePublisherFirst` and `defineConsumerFirst` for compile-time validation. You can also use them directly when building advanced routing logic or helper functions.

::: info Note on Validation
TypeScript's type system has recursion depth limits (~50 levels). For very long routing keys or deeply nested patterns, validation may fall back to `string`. This doesn't affect runtime behavior—it only means some edge cases won't be caught at compile time.
:::

## Next Steps

- Learn about [Client Usage](/guide/client-usage)
- Understand [Worker Usage](/guide/worker-usage)
