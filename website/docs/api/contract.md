# @amqp-contract/contract

Core package for defining type-safe AMQP contracts.

## Installation

```bash
pnpm add @amqp-contract/contract
```

## Main Exports

### `defineContract`

Creates a complete AMQP contract.

**Signature:**

```typescript
function defineContract<T extends ContractDefinition>(
  definition: T
): Contract<T>
```

**Example:**

```typescript
const contract = defineContract({
  exchanges: { /* ... */ },
  queues: { /* ... */ },
  bindings: { /* ... */ },
  publishers: { /* ... */ },
  consumers: { /* ... */ },
});
```

**Parameters:**

- `definition` - Object containing exchanges, queues, bindings, publishers, and consumers

**Returns:** A type-safe contract object

---

### `defineExchange`

Defines an AMQP exchange.

**Signature:**

```typescript
function defineExchange(
  name: string,
  type: 'direct' | 'topic' | 'fanout' | 'headers',
  options?: ExchangeOptions
): ExchangeDefinition
```

**Example:**

```typescript
const ordersExchange = defineExchange('orders', 'topic', {
  durable: true,
  autoDelete: false,
});
```

**Parameters:**

- `name` - Exchange name
- `type` - Exchange type (`direct`, `topic`, `fanout`, `headers`)
- `options` - Optional exchange options
  - `durable` - Exchange survives broker restart (default: `false`)
  - `autoDelete` - Delete when no queues bound (default: `false`)
  - `internal` - Exchange is internal (default: `false`)
  - `arguments` - Additional AMQP arguments

**Returns:** Exchange definition

---

### `defineQueue`

Defines an AMQP queue.

**Signature:**

```typescript
function defineQueue(
  name: string,
  options?: QueueOptions
): QueueDefinition
```

**Example:**

```typescript
const processingQueue = defineQueue('order-processing', {
  durable: true,
  exclusive: false,
  autoDelete: false,
});
```

**Parameters:**

- `name` - Queue name
- `options` - Optional queue options
  - `durable` - Queue survives broker restart (default: `false`)
  - `exclusive` - Queue can only be used by this connection (default: `false`)
  - `autoDelete` - Delete when no consumers (default: `false`)
  - `arguments` - Additional AMQP arguments (e.g., TTL, DLX)

**Returns:** Queue definition

---

### `defineQueueBinding`

Defines a binding between a queue and an exchange.

**Signature:**

```typescript
// For fanout exchanges (no routing key needed)
function defineQueueBinding(
  queue: QueueDefinition,
  exchange: FanoutExchangeDefinition,
  options?: { arguments?: Record<string, unknown> }
): QueueBindingDefinition

// For direct/topic exchanges (routing key required)
function defineQueueBinding(
  queue: QueueDefinition,
  exchange: DirectExchangeDefinition | TopicExchangeDefinition,
  options: {
    routingKey: string;
    arguments?: Record<string, unknown>;
  }
): QueueBindingDefinition
```

**Example:**

```typescript
const orderProcessingQueue = defineQueue('order-processing', { durable: true });
const ordersExchange = defineExchange('orders', 'topic', { durable: true });

const orderBinding = defineQueueBinding(orderProcessingQueue, ordersExchange, {
  routingKey: 'order.created',
});
```

**Parameters:**

- `queue` - Queue definition object (from `defineQueue`)
- `exchange` - Exchange definition object (from `defineExchange`)
- `options` - Binding options
  - `routingKey` - Routing key pattern (required for direct/topic exchanges)
  - `arguments` - Additional AMQP arguments

**Returns:** Binding definition

---

### `defineExchangeBinding`

Defines a binding between two exchanges (source → destination).

**Signature:**

```typescript
// For fanout exchanges (no routing key needed)
function defineExchangeBinding(
  destination: ExchangeDefinition,
  source: FanoutExchangeDefinition,
  options?: { arguments?: Record<string, unknown> }
): ExchangeBindingDefinition

// For direct/topic exchanges (routing key required)
function defineExchangeBinding(
  destination: ExchangeDefinition,
  source: DirectExchangeDefinition | TopicExchangeDefinition,
  options: {
    routingKey: string;
    arguments?: Record<string, unknown>;
  }
): ExchangeBindingDefinition
```

**Example:**

```typescript
const sourceExchange = defineExchange('source', 'topic', { durable: true });
const destExchange = defineExchange('destination', 'topic', { durable: true });

const exchangeBinding = defineExchangeBinding(destExchange, sourceExchange, {
  routingKey: 'order.#',
});
```

**Parameters:**

- `destination` - Destination exchange definition object
- `source` - Source exchange definition object
- `options` - Binding options
  - `routingKey` - Routing key pattern (required for direct/topic exchanges)
  - `arguments` - Additional AMQP arguments

**Returns:** Exchange binding definition

---

### `defineMessage`

Defines a message with payload schema and optional metadata.

**Signature:**

```typescript
function defineMessage<TPayload, THeaders>(
  payload: TPayload,
  options?: {
    headers?: THeaders;
    summary?: string;
    description?: string;
  }
): MessageDefinition<TPayload, THeaders>
```

**Example:**

```typescript
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  {
    summary: 'Order created event',
    description: 'Emitted when a new order is created in the system',
  }
);
```

**Parameters:**

- `payload` - Message payload schema (Standard Schema v1 compatible)
- `options` - Optional message metadata
  - `headers` - Optional header schema
  - `summary` - Short description for documentation
  - `description` - Detailed description for documentation

**Returns:** Message definition

---

### `definePublisher`

Defines a message publisher with schema validation.

**Signature:**

```typescript
// For fanout exchanges (no routing key needed)
function definePublisher<TMessage>(
  exchange: FanoutExchangeDefinition,
  message: TMessage,
  options?: {}
): PublisherDefinition<TMessage>

// For direct/topic exchanges (routing key required)
function definePublisher<TMessage>(
  exchange: DirectExchangeDefinition | TopicExchangeDefinition,
  message: TMessage,
  options: { routingKey: string }
): PublisherDefinition<TMessage>
```

**Example:**

```typescript
const ordersExchange = defineExchange('orders', 'topic', { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  })
);

const orderCreatedPublisher = definePublisher(ordersExchange, orderMessage, {
  routingKey: 'order.created',
});
```

**Parameters:**

- `exchange` - Exchange definition object (from `defineExchange`)
- `message` - Message definition (from `defineMessage`)
- `options` - Publisher options
  - `routingKey` - Routing key (required for direct/topic exchanges)

**Returns:** Publisher definition with inferred type

---

### `defineConsumer`

Defines a message consumer with schema validation.

**Signature:**

```typescript
function defineConsumer<TMessage>(
  queue: QueueDefinition,
  message: TMessage,
  options?: ConsumerOptions
): ConsumerDefinition<TMessage>
```

**Example:**

```typescript
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    amount: z.number(),
  })
);

const processOrderConsumer = defineConsumer(orderProcessingQueue, orderMessage, {
  prefetch: 10,
  noAck: false,
});
```

**Parameters:**

- `queue` - Queue definition object (from `defineQueue`)
- `message` - Message definition (from `defineMessage`)
- `options` - Optional consumer options
  - `prefetch` - Maximum unacknowledged messages (default: `0` = unlimited)
  - `noAck` - Automatic acknowledgment (default: `false`)

**Returns:** Consumer definition with inferred type

## Types

### `ContractDefinition`

```typescript
interface ContractDefinition {
  exchanges?: Record<string, ExchangeDefinition>;
  queues?: Record<string, QueueDefinition>;
  bindings?: Record<string, BindingDefinition>;
  publishers?: Record<string, PublisherDefinition<any>>;
  consumers?: Record<string, ConsumerDefinition<any>>;
}
```

### `ExchangeOptions`

```typescript
interface ExchangeOptions {
  durable?: boolean;
  autoDelete?: boolean;
  internal?: boolean;
  arguments?: Record<string, any>;
}
```

### `QueueOptions`

```typescript
interface QueueOptions {
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, any>;
}
```

### `BindingOptions`

```typescript
interface BindingOptions {
  routingKey?: string;
  arguments?: Record<string, any>;
}
```

### `PublisherOptions`

```typescript
interface PublisherOptions {
  routingKey?: string;
}
```

### `ConsumerOptions`

```typescript
interface ConsumerOptions {
  prefetch?: number;
  noAck?: boolean;
  exclusive?: boolean;
  consumerTag?: string;
  arguments?: Record<string, any>;
}
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
const orderProcessingQueue = defineQueue('order-processing', {
  durable: true,
  arguments: {
    'x-message-ttl': 86400000, // 24 hours
    'x-dead-letter-exchange': 'orders-dlx',
  },
});

// 3. Define messages
const orderMessage = defineMessage(
  z.object({
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    amount: z.number().positive(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })),
    createdAt: z.string().datetime(),
  }),
  {
    summary: 'Order created event',
    description: 'Emitted when a new order is created',
  }
);

// 4. Compose contract using object references
export const contract = defineContract({
  exchanges: {
    orders: ordersExchange,
  },
  queues: {
    orderProcessing: orderProcessingQueue,
  },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage, {
      prefetch: 10,
      noAck: false,
    }),
  },
});
```

## See Also

- [Client API](/api/client) - Publishing messages
- [Worker API](/api/worker) - Consuming messages
- [Defining Contracts Guide](/guide/defining-contracts)
