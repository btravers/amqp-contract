# Contract Patterns

## Contract Composition

Resources are defined individually then composed into a contract. `defineContract` only accepts `publishers` and `consumers` — exchanges, queues, and bindings are automatically extracted and inferred:

```typescript
const dlx = defineExchange("orders-dlx", "direct", { durable: true });
const exchange = defineExchange("orders", "topic", { durable: true });
const queue = defineQueue("processing", {
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
  deliveryLimit: 5,
});
const message = defineMessage(z.object({ orderId: z.string() }));

// Define event publisher
const orderCreatedEvent = defineEventPublisher(exchange, message, { routingKey: "order.created" });

// Compose contract — only publishers and consumers are specified
// Exchanges, queues, and bindings are automatically extracted
const contract = defineContract({
  publishers: { orderCreated: orderCreatedEvent },
  consumers: { processOrder: defineEventConsumer(orderCreatedEvent, queue) },
});

// contract.exchanges contains: { orders: exchange, 'orders-dlx': dlx }
// contract.queues contains: { processing: queue }
// contract.bindings contains: { processOrderBinding: ... }
```

## Event and Command Patterns

| Pattern     | Use Case                                   | Flow                                               |
| ----------- | ------------------------------------------ | -------------------------------------------------- |
| **Event**   | One publisher, many consumers (broadcast)  | `defineEventPublisher` → `defineEventConsumer`     |
| **Command** | Many publishers, one consumer (task queue) | `defineCommandConsumer` → `defineCommandPublisher` |

```typescript
// Event Pattern: Publisher broadcasts, multiple consumers subscribe
const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

// Consumer can override routing key for topic exchanges
const allOrdersConsumer = defineEventConsumer(orderCreatedEvent, allOrdersQueue, {
  routingKey: "order.*", // Pattern to receive multiple events
});

// Command Pattern: Consumer owns the queue, publishers send to it
const processOrderCommand = defineCommandConsumer(orderQueue, ordersExchange, orderMessage, {
  routingKey: "order.process",
});

// For topic exchanges, publisher can specify concrete routing key
const createOrderPublisher = defineCommandPublisher(processOrderCommand, {
  routingKey: "order.create",
});

// Compose contract — only publishers and consumers are specified
const contract = defineContract({
  publishers: {
    orderCreated: orderCreatedEvent,
    createOrder: createOrderPublisher,
  },
  consumers: {
    processOrder: defineEventConsumer(orderCreatedEvent, processingQueue),
    allOrders: allOrdersConsumer,
    handleOrder: processOrderCommand,
  },
});
// contract.exchanges, contract.queues, and contract.bindings are auto-populated
```

## Exchange Types

- Use appropriate exchange type: `direct`, `fanout`, `topic`, or `headers`
- Topic exchanges are most flexible for routing patterns
- Direct exchanges for simple point-to-point messaging
- Fanout exchanges for broadcast messaging

## Queue Types

- **Quorum queues are the default** and recommended for most use cases
- Use `type: 'quorum'` (default) for reliable, replicated queues
- Use `type: 'classic'` only for special cases (priority queues, exclusive queues)
- Quorum queues are always durable and cannot be exclusive
- Configure `deliveryLimit` for native retry support

```typescript
// Quorum queue (default, recommended)
const orderQueue = defineQueue("orders", {
  type: "quorum", // default, can be omitted
  deliveryLimit: 3, // Native retry: dead-letter after 3 attempts
  deadLetter: { exchange: dlx },
});

// Classic queue for special cases only
const priorityQueue = defineQueue("priority-tasks", {
  type: "classic",
  durable: true,
  maxPriority: 10, // Only supported with classic queues
});
```

## Bindings

- Queue-to-exchange bindings are **auto-generated** by `defineEventConsumer` and `defineCommandConsumer`
- Exchange-to-exchange bindings must be set up manually via `AmqpClient` channel setup
- For fanout exchanges, routing keys are optional

```typescript
// Bindings are auto-generated from event/command consumers:
const consumer = defineEventConsumer(orderCreatedEvent, orderProcessingQueue);
// This auto-generates: orderProcessingQueue → ordersExchange (order.created)

// Exchange-to-exchange binding (manual setup via channel)
const exchangeBinding = defineExchangeBinding(analyticsExchange, ordersExchange, {
  routingKey: "order.#", // Forward all order events
});
```

## Routing Keys

- Use meaningful, hierarchical routing keys (e.g., `order.created`, `order.updated`)
- Topic patterns: `#` matches zero or more words, `*` matches exactly one word
- Document routing key patterns in comments

## Message Schemas

- Always validate both input and output messages
- Use Standard Schema v1 compliant libraries (Zod, Valibot, ArkType)
- Define schemas as const to enable type inference
- Use `defineMessage` to wrap schemas with optional metadata

```typescript
import { defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      }),
    ),
    totalAmount: z.number().positive(),
  }),
  {
    summary: "Order created event",
    description: "Emitted when a new order is created in the system",
  },
);
```

## Retry Configuration

Retry strategy is configured at the queue level in the contract, not at the handler level.

### Quorum-Native Mode (Recommended)

Uses RabbitMQ's native `x-delivery-limit` feature. Messages requeued immediately with `nack(requeue=true)`. Simpler, no wait queues needed.

```typescript
const queue = defineQueue("orders", {
  deliveryLimit: 5,
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
});
```

### TTL-Backoff Mode

Uses wait queues with exponential backoff. Infrastructure is **automatically generated** when `defineQueue` is called with TTL-backoff retry and a dead letter exchange.

```typescript
const queue = defineQueue("orders", {
  deadLetter: { exchange: dlx },
  retry: {
    mode: "ttl-backoff",
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },
});
```

### Accessing Queue Properties

When retry is configured with TTL-backoff mode, `defineQueue` returns a wrapper object. Use `extractQueue()` to access the underlying queue definition:

```typescript
import { extractQueue } from "@amqp-contract/contract";
const queueName = extractQueue(queue).name;
```

## Type Inference Helpers

The `Infer*` naming pattern indicates type inference helpers that extract types from a contract at compile time:

- `ClientInferPublisherInput<Contract, "publisherName">` — Publisher input type
- `WorkerInferConsumerInput<Contract, "consumerName">` — Consumer input type
- `WorkerInferConsumerHandler<Contract, "consumerName">` — Handler type
- `WorkerInferConsumedMessage<Contract, "consumerName">` — Full message type (payload + headers)
