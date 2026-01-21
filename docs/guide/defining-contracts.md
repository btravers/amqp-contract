---
title: Defining Contracts - Type-safe AMQP Message Schema Definitions
description: Master contract definition patterns for AMQP messaging. Learn event and command approaches for building type-safe RabbitMQ applications with schema validation.
---

# Defining Contracts

Learn how to define AMQP contracts with full type safety.

## Recommended Approach: Event and Command Patterns

::: tip RECOMMENDED
For robust contract definitions with guaranteed consistency, use **Event** or **Command** patterns. These patterns ensure message schema and routing key consistency between publishers and consumers.
:::

| Pattern     | Use Case                                   | Flow                                               |
| ----------- | ------------------------------------------ | -------------------------------------------------- |
| **Event**   | One publisher, many consumers (broadcast)  | `defineEventPublisher` → `defineEventConsumer`     |
| **Command** | Many publishers, one consumer (task queue) | `defineCommandConsumer` → `defineCommandPublisher` |

### Event Pattern (Broadcast)

Use this pattern for **events** where publishers broadcast messages without knowing who consumes them. Multiple consumers can subscribe to the same event:

```typescript
import {
  defineEventPublisher,
  defineEventConsumer,
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define exchange and message
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    amount: z.number().positive(),
  }),
);

// Event pattern: define publisher that broadcasts events
const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

// Multiple queues can consume the same event
const orderQueue = defineQueue("order-processing", { durable: true });
const analyticsQueue = defineQueue("analytics", { durable: true });

// Create consumers that subscribe to the event
const { consumer: processConsumer, binding: processBinding } = defineEventConsumer(
  orderCreatedEvent,
  orderQueue,
);
const { consumer: analyticsConsumer, binding: analyticsBinding } = defineEventConsumer(
  orderCreatedEvent,
  analyticsQueue,
);

// Compose contract
export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderQueue, analyticsQueue },
  bindings: {
    orderBinding: processBinding,
    analyticsBinding: analyticsBinding,
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, { routingKey: "order.created" }),
  },
  consumers: {
    processOrder: processConsumer, // Same message schema
    trackOrder: analyticsConsumer, // Same message schema
  },
});
```

**Benefits:**

- ✅ Publishers don't need to know about queues (true event-oriented)
- ✅ Multiple consumers can subscribe to the same event
- ✅ Guaranteed message schema consistency
- ✅ Automatic routing key synchronization

#### Topic Exchange with Event Pattern

For topic exchanges, consumers can optionally override the routing key with their own binding patterns:

```typescript
// Publisher uses a concrete routing key
const orderCreatedEvent = defineEventPublisher(
  ordersExchange, // topic exchange
  orderMessage,
  { routingKey: "order.created" },
);

// Consumers can use different patterns or the default key
const { consumer: exactConsumer, binding: exactBinding } = defineEventConsumer(
  orderCreatedEvent,
  exactMatchQueue,
); // Uses 'order.created'

const { consumer: patternConsumer, binding: patternBinding } = defineEventConsumer(
  orderCreatedEvent,
  allOrdersQueue,
  { routingKey: "order.*" }, // Override with pattern
);

export const contract = defineContract({
  // ...
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, { routingKey: "order.created" }),
  },
  consumers: {
    processExactOrder: exactConsumer, // Receives only 'order.created'
    processAllOrders: patternConsumer, // Receives any 'order.*' messages
  },
});
```

**Pattern Matching:**

- `*` matches exactly one word (e.g., `order.*` matches `order.created` but not `order.item.shipped`)
- `#` matches zero or more words (e.g., `order.#` matches `order.created`, `order.item.shipped`, etc.)

### Command Pattern (Task Queue)

Use this pattern for **commands** where the consumer "owns" the queue and publishers send commands to it:

```typescript
import {
  defineCommandConsumer,
  defineCommandPublisher,
  defineContract,
  defineQueue,
  defineExchange,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define queue, exchange, and message
const taskQueue = defineQueue("tasks", { durable: true });
const tasksExchange = defineExchange("tasks", "direct", { durable: true });
const taskMessage = defineMessage(
  z.object({
    taskId: z.string(),
    action: z.string(),
  }),
);

// Command pattern: consumer owns the queue and defines what it accepts
const executeTaskCommand = defineCommandConsumer(taskQueue, tasksExchange, taskMessage, {
  routingKey: "task.execute",
});

// Publishers send commands to the consumer
const executeTaskPublisher = defineCommandPublisher(executeTaskCommand);

// Compose contract
export const contract = defineContract({
  exchanges: { tasks: tasksExchange },
  queues: { taskQueue },
  bindings: {
    taskBinding: executeTaskCommand.binding,
  },
  publishers: {
    executeTask: executeTaskPublisher,
  },
  consumers: {
    processTask: executeTaskCommand.consumer,
  },
});
```

**Benefits:**

- ✅ Consumer defines the contract (command pattern)
- ✅ Publishers automatically match consumer expectations
- ✅ Guaranteed message schema consistency
- ✅ Routing key type validation at compile time

#### Topic Exchange with Command Pattern

For topic exchanges, the consumer binding can use patterns with wildcards, and publishers can specify concrete routing keys that match the pattern:

```typescript
// Consumer binds with a pattern
const processOrdersCommand = defineCommandConsumer(
  orderQueue,
  ordersExchange, // topic exchange
  orderMessage,
  { routingKey: "order.*" }, // Pattern with wildcard
);

// Publishers can use concrete keys that match the pattern
const createOrderPublisher = defineCommandPublisher(processOrdersCommand, {
  routingKey: "order.created",
});
const updateOrderPublisher = defineCommandPublisher(processOrdersCommand, {
  routingKey: "order.updated",
});
const shipOrderPublisher = defineCommandPublisher(processOrdersCommand, {
  routingKey: "order.shipped",
});

export const contract = defineContract({
  // ...
  publishers: {
    orderCreated: createOrderPublisher, // Matches order.*
    orderUpdated: updateOrderPublisher, // Matches order.*
    orderShipped: shipOrderPublisher, // Matches order.*
  },
  consumers: {
    processOrders: processOrdersCommand.consumer,
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
  exchanges: {
    /* ... */
  },
  queues: {
    /* ... */
  },
  bindings: {
    /* ... */
  },
  publishers: {
    /* ... */
  },
  consumers: {
    /* ... */
  },
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
import { defineExchange } from "@amqp-contract/contract";

// Define exchanges as variables
const ordersExchange = defineExchange("orders", "topic", {
  durable: true,
  autoDelete: false,
});

const notificationsExchange = defineExchange("notifications", "fanout", {
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

Queues store messages. By default, queues are created as **quorum queues** which provide better durability and high-availability using the Raft consensus algorithm.

```typescript
import { defineQueue } from "@amqp-contract/contract";

// Quorum queue (default, recommended for production)
const orderProcessingQueue = defineQueue("order-processing");

// Explicit quorum queue with options
const orderProcessingQueueExplicit = defineQueue("order-processing", {
  type: "quorum", // Default - provides better durability and HA
});

// Classic queue (for special cases like non-durable or priority queues)
const tempQueue = defineQueue("temp-queue", {
  type: "classic",
  durable: false, // Only supported with classic queues
  autoDelete: true,
});

const contract = defineContract({
  queues: {
    orderProcessing: orderProcessingQueue,
  },
});
```

**Queue Types:**

- `quorum` (default) - Quorum queues provide better durability and high-availability. They are always durable and do not support `exclusive` mode or priority queues.
- `classic` - Traditional RabbitMQ queue type. Use when you need non-durable queues, exclusive queues, or priority queues.

::: tip Best Practice
Use quorum queues (the default) for production workloads. Only use classic queues when you need specific features not supported by quorum queues.
:::

### Quorum Queue Delivery Limit

Quorum queues support a native `deliveryLimit` option for automatic retry handling. When a message is nacked and requeued, RabbitMQ tracks the delivery count. Once the count exceeds the limit, the message is automatically dead-lettered.

```typescript
import { defineQueue, defineExchange } from "@amqp-contract/contract";

const dlx = defineExchange("orders-dlx", "topic", { durable: true });

// Quorum queue with delivery limit for automatic retry handling
const orderQueue = defineQueue("order-processing", {
  type: "quorum", // Default
  deliveryLimit: 3, // Dead-letter after 3 delivery attempts
  deadLetter: {
    exchange: dlx,
    routingKey: "order.failed",
  },
});
```

**Benefits of `deliveryLimit`:**

- **Simpler architecture** - No wait queues needed for retry handling
- **No head-of-queue blocking** - Unlike TTL-based retry, delivery limit works correctly regardless of message order
- **Native RabbitMQ tracking** - Delivery count tracked via `x-delivery-count` header
- **Atomic guarantees** - RabbitMQ handles the retry logic internally

::: warning Note
The `deliveryLimit` option only works with quorum queues. For classic queues, use the `ttl-backoff` retry mode which creates wait queues with per-message TTL.
:::

### Retry Configuration

Configure automatic retry behavior at the queue level using the `retry` option. This determines how failed messages are handled by the worker.

#### Quorum-Native Mode

For quorum queues, use `quorum-native` mode which leverages RabbitMQ's built-in delivery tracking:

```typescript
import { defineQueue, defineExchange } from "@amqp-contract/contract";

const dlx = defineExchange("orders-dlx", "topic", { durable: true });

const orderQueue = defineQueue("order-processing", {
  type: "quorum",
  deliveryLimit: 3, // Dead-letter after 3 delivery attempts
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
});
```

**Benefits:**

- **Simpler architecture** - No wait queues needed
- **Native tracking** - RabbitMQ tracks delivery count automatically
- **No head-of-queue blocking** - Messages are requeued immediately

#### TTL-Backoff Mode

For exponential backoff with delays between retries, use `ttl-backoff` mode:

```typescript
import { defineQueue, defineExchange } from "@amqp-contract/contract";

const dlx = defineExchange("orders-dlx", "topic", { durable: true });

const orderQueue = defineQueue("order-processing", {
  deadLetter: { exchange: dlx },
  retry: {
    mode: "ttl-backoff",
    maxRetries: 5,
    initialDelayMs: 1000, // Start with 1 second delay
    maxDelayMs: 60000, // Cap at 60 seconds
    backoffMultiplier: 2, // Double delay each retry
    jitter: true, // Add randomness to prevent thundering herd
  },
});
```

When you use `ttl-backoff` mode, `defineContract` automatically generates:

- A wait queue (`{queueName}-wait`) with per-message TTL
- Bindings to route messages through the DLX for retry

**Benefits:**

- **Exponential backoff** - Give failing services time to recover
- **Jitter support** - Prevents thundering herd problems
- **Works with any queue type** - Classic or quorum

**Default values for TTL-backoff:**

| Option              | Default | Description                        |
| ------------------- | ------- | ---------------------------------- |
| `maxRetries`        | 3       | Maximum retry attempts             |
| `initialDelayMs`    | 1000    | Initial delay in milliseconds      |
| `maxDelayMs`        | 30000   | Maximum delay cap in milliseconds  |
| `backoffMultiplier` | 2       | Multiplier for exponential backoff |
| `jitter`            | true    | Add randomness to delays           |

See the [Worker Usage Guide](/guide/worker-usage#retry-strategies) for more details on retry behavior.

## Defining Messages

Messages wrap schemas with optional metadata:

```typescript
import { defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number().positive(),
  }),
  {
    summary: "Order created event",
    description: "Emitted when a new order is created",
  },
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
import { defineQueueBinding } from "@amqp-contract/contract";

const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const allOrdersQueue = defineQueue("all-orders", { durable: true });

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: {
    orderProcessing: orderProcessingQueue,
    allOrders: allOrdersQueue,
  },
  bindings: {
    // Exact routing key
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
    // Wildcard pattern
    allOrdersBinding: defineQueueBinding(allOrdersQueue, ordersExchange, {
      routingKey: "order.*",
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
import { definePublisher, defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

const ordersExchange = defineExchange("orders", "topic", { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
    createdAt: z.string().datetime(),
  }),
);

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
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
import { defineConsumer, defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

const orderProcessingQueue = defineQueue("order-processing", { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
    createdAt: z.string().datetime(),
  }),
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
} from "@amqp-contract/contract";
import { z } from "zod";

// 1. Define exchanges
const ordersExchange = defineExchange("orders", "topic", { durable: true });

// 2. Define queues
const orderProcessingQueue = defineQueue("order-processing", { durable: true });
const orderNotificationsQueue = defineQueue("order-notifications", { durable: true });

// 3. Define messages
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
  }),
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
      routingKey: "order.created",
    }),
    notificationBinding: defineQueueBinding(orderNotificationsQueue, ordersExchange, {
      routingKey: "order.created",
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
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
import { defineExchangeBinding } from "@amqp-contract/contract";

const sourceExchange = defineExchange("source", "topic", { durable: true });
const destExchange = defineExchange("destination", "topic", { durable: true });

const contract = defineContract({
  exchanges: {
    source: sourceExchange,
    destination: destExchange,
  },
  bindings: {
    // Messages from source flow to destination
    crossExchange: defineExchangeBinding(destExchange, sourceExchange, {
      routingKey: "order.#",
    }),
  },
});
```

## When to Use Each Approach

### Use Event / Command Patterns (Recommended)

✅ **Use for most cases** - Provides consistency guarantees and prevents runtime errors

- Event-driven architectures (use `defineEventPublisher` → `defineEventConsumer`)
- Command patterns (use `defineCommandConsumer` → `defineCommandPublisher`)
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
import { RoutingKey, BindingPattern, MatchingRoutingKey } from "@amqp-contract/contract";

// Validate routing key format and character set
type ValidKey = RoutingKey<"order.created">; // ✅ 'order.created'
type InvalidKey = RoutingKey<"order..bad">; // ❌ never (empty segment)

// Validate binding pattern with wildcards
type ValidPattern = BindingPattern<"order.*">; // ✅ 'order.*'
type ValidHashPattern = BindingPattern<"order.#">; // ✅ 'order.#'
type InvalidPattern = BindingPattern<"order.!">; // ❌ never (invalid wildcard)

// Validate routing key matches a pattern
type OrderCreated = MatchingRoutingKey<"order.*", "order.created">; // ✅ 'order.created'
type OrderShipped = MatchingRoutingKey<"order.*", "order.shipped">; // ✅ 'order.shipped'
type InvalidMatch = MatchingRoutingKey<"order.*", "user.created">; // ❌ never (doesn't match)
```

**Validation Rules:**

- **Character Set**: Only alphanumeric characters, hyphens (`-`), and underscores (`_`) allowed
- **Format**: Dot-separated segments (e.g., `order.created`, `user.login.success`)
- **Wildcards**:
  - `*` matches exactly one word
  - `#` matches zero or more words
  - Only valid in binding patterns, not routing keys

These types are used internally by `defineEventPublisher`, `defineEventConsumer`, `defineCommandConsumer`, and `defineCommandPublisher` for compile-time validation. You can also use them directly when building advanced routing logic or helper functions.

::: info Note on Validation
TypeScript's type system has recursion depth limits (~50 levels). For very long routing keys or deeply nested patterns, validation may fall back to `string`. This doesn't affect runtime behavior—it only means some edge cases won't be caught at compile time.
:::

## Dead Letter Exchanges

Dead Letter Exchanges (DLX) automatically handle failed, rejected, or expired messages. When a message in a queue is rejected (nack), expires (TTL), or the queue reaches its length limit, it can be automatically routed to a DLX for further processing or storage.

### Basic Dead Letter Configuration

```typescript
import {
  defineExchange,
  defineQueue,
  defineQueueBinding,
  defineContract,
} from "@amqp-contract/contract";

// 1. Define the dead letter exchange
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });

// 2. Define the main queue with dead letter configuration
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: ordersDlx,
    routingKey: "order.failed", // Optional: routing key for DLX
  },
  // Optional: Add message TTL to automatically move old messages to DLX
  arguments: {
    "x-message-ttl": 86400000, // 24 hours in milliseconds
  },
});

// 3. Define a queue to collect dead-lettered messages
const ordersDlxQueue = defineQueue("orders-dlx-queue", { durable: true });

// 4. Compose the contract
export const contract = defineContract({
  exchanges: {
    ordersDlx,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
    ordersDlxQueue,
  },
  bindings: {
    // Bind the DLX queue to receive failed messages
    dlxBinding: defineQueueBinding(ordersDlxQueue, ordersDlx, {
      routingKey: "order.failed",
    }),
  },
});
```

### Dead Letter Features

**Automatic Routing**: Messages are automatically routed to the DLX when:

- A message is rejected with `nack` and `requeue: false`
- A message's TTL (time-to-live) expires
- The queue reaches its maximum length

**Routing Key Options**:

- If `routingKey` is specified, it will be used when routing to the DLX
- If not specified, the original message routing key is preserved

**Common Use Cases**:

- **Error Handling**: Collect and process failed messages
- **Message Expiry**: Handle expired messages separately
- **Retry Logic**: Implement custom retry strategies for failed messages
- **Debugging**: Store failed messages for analysis

### Complete DLX Example

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  definePublisher,
  defineConsumer,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define exchanges
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const ordersDlx = defineExchange("orders-dlx", "topic", { durable: true });

// Define message schema
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
);

// Define queues with DLX configuration
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: ordersDlx,
    routingKey: "order.failed",
  },
  arguments: {
    "x-message-ttl": 86400000, // 24 hours
  },
});

const ordersDlxQueue = defineQueue("orders-dlx-queue", { durable: true });

// Compose contract
export const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
    ordersDlx,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
    ordersDlxQueue,
  },
  bindings: {
    // Main queue binding
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
    // DLX queue binding
    dlxBinding: defineQueueBinding(ordersDlxQueue, ordersDlx, {
      routingKey: "order.failed",
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: "order.created",
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
    handleFailedOrders: defineConsumer(ordersDlxQueue, orderMessage),
  },
});
```

::: tip Best Practices

- Always declare the DLX in your contract's `exchanges`
- Create a dedicated queue for collecting dead-lettered messages
- Use meaningful routing keys for DLX messages (e.g., `order.failed`)
- Consider implementing retry logic in your DLX consumer
- Monitor DLX queues for issues in your message processing
  :::

## Next Steps

- Learn about [Client Usage](/guide/client-usage)
- Understand [Worker Usage](/guide/worker-usage)
