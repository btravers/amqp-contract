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
function defineQueueBinding(
  queue: string,
  exchange: string,
  options?: BindingOptions
): BindingDefinition
```

**Example:**

```typescript
const orderBinding = defineQueueBinding('order-processing', 'orders', {
  routingKey: 'order.created',
});
```

**Parameters:**

- `queue` - Queue name (must match a defined queue)
- `exchange` - Exchange name (must match a defined exchange)
- `options` - Optional binding options
  - `routingKey` - Routing key pattern (default: `''`)
  - `arguments` - Additional AMQP arguments

**Returns:** Binding definition

---

### `definePublisher`

Defines a message publisher with schema validation.

**Signature:**

```typescript
function definePublisher<TSchema>(
  exchange: string,
  schema: TSchema,
  options?: PublisherOptions
): PublisherDefinition<TSchema>
```

**Example:**

```typescript
const orderCreatedPublisher = definePublisher(
  'orders',
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  {
    routingKey: 'order.created',
  }
);
```

**Parameters:**

- `exchange` - Exchange name (must match a defined exchange)
- `schema` - Message schema (Zod, Valibot, ArkType, or any Standard Schema)
- `options` - Optional publisher options
  - `routingKey` - Default routing key (can be overridden at publish time)

**Returns:** Publisher definition with inferred type

---

### `defineConsumer`

Defines a message consumer with schema validation.

**Signature:**

```typescript
function defineConsumer<TSchema>(
  queue: string,
  schema: TSchema,
  options?: ConsumerOptions
): ConsumerDefinition<TSchema>
```

**Example:**

```typescript
const processOrderConsumer = defineConsumer(
  'order-processing',
  z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  {
    prefetch: 10,
    noAck: false,
  }
);
```

**Parameters:**

- `queue` - Queue name (must match a defined queue)
- `schema` - Message schema (Zod, Valibot, ArkType, or any Standard Schema)
- `options` - Optional consumer options
  - `prefetch` - Maximum unacknowledged messages (default: `0` = unlimited)
  - `noAck` - Automatic acknowledgment (default: `false`)
  - `exclusive` - Exclusive consumer (default: `false`)
  - `consumerTag` - Consumer identifier
  - `arguments` - Additional AMQP arguments

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
} from '@amqp-contract/contract';
import { z } from 'zod';

const orderSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
  createdAt: z.string().datetime(),
});

export const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', {
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours
        'x-dead-letter-exchange': 'orders-dlx',
      },
    }),
  },
  bindings: {
    orderBinding: defineQueueBinding('order-processing', 'orders', {
      routingKey: 'order.created',
    }),
  },
  publishers: {
    orderCreated: definePublisher('orders', orderSchema, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', orderSchema, {
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
