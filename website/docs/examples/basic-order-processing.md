# Basic Order Processing

A complete example demonstrating type-safe AMQP messaging with the RabbitMQ topic pattern.

## Overview

This example showcases:

- ✅ Contract definition with Zod schemas
- ✅ Type-safe message publishing
- ✅ Type-safe message consumption
- ✅ RabbitMQ topic exchange with wildcards
- ✅ Multiple consumers with different routing patterns
- ✅ Full end-to-end type safety

## Architecture

The example consists of three packages:

1. **Contract** - Shared contract definition
2. **Client** - Publisher application
3. **Worker** - Consumer application with multiple handlers

## Topic Exchange Pattern

This example demonstrates RabbitMQ's powerful topic exchange pattern for flexible message routing.

### Routing Diagram

```
                                    ┌─────────────────┐
                                    │  Topic Exchange │
                                    │    "orders"     │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
         order.created  │     order.#        │   order.shipped    │  order.*.urgent
                        │                    │                    │
                        ▼                    ▼                    ▼
              ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
              │ order-processing │  │order-notifications│  │  order-shipping  │
              │      Queue       │  │      Queue        │  │      Queue       │
              └────────┬─────────┘  └────────┬──────────┘  └────────┬─────────┘
                       │                     │                       │
                       ▼                     ▼                       ▼
              ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
              │  processOrder    │  │   notifyOrder    │  │    shipOrder     │
              │    Handler       │  │    Handler       │  │    Handler       │
              └──────────────────┘  └──────────────────┘  └──────────────────┘

                                                           ┌──────────────────┐
                                                           │  order-urgent    │
                                                           │      Queue       │
                                                           └────────┬─────────┘
                                                                    │
                                                                    ▼
                                                           ┌──────────────────┐
                                                           │handleUrgentOrder │
                                                           │    Handler       │
                                                           └──────────────────┘
```

### Routing Keys

The example uses these routing keys:

- `order.created` - New orders
- `order.updated` - Regular status updates
- `order.shipped` - Shipped orders
- `order.*.urgent` - Urgent updates (wildcard pattern)

### Routing Patterns

#### Exact Match

- `order.created` → matches only `order.created` messages
- `order.shipped` → matches only `order.shipped` messages

#### Multiple Word Wildcard (`#`)

- `order.#` → matches zero or more words after "order."
  - ✅ Matches: `order.created`, `order.updated`, `order.shipped`, `order.updated.urgent`

#### Single Word Wildcard (`*`)

- `order.*.urgent` → matches any single word between "order." and ".urgent"
  - ✅ Matches: `order.created.urgent`, `order.updated.urgent`
  - ❌ Does NOT match: `order.created`, `order.updated`

## Running the Example

### Prerequisites

Start RabbitMQ:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4-management
```

### Setup

Install dependencies and build:

```bash
pnpm install
pnpm build
```

### Run

Open two terminals:

**Terminal 1 - Start the worker:**

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev
```

**Terminal 2 - Run the client:**

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

### Expected Output

The client publishes 5 messages, and you'll see the worker process them according to the routing patterns:

**Client Output:**

```
1️⃣ Publishing NEW ORDER (order.created)
   ✓ Published order ORD-001
   → Will be received by: processing & notifications queues

2️⃣ Publishing ORDER UPDATE (order.updated)
   ✓ Published update for ORD-001
   → Will be received by: notifications queue only

3️⃣ Publishing ORDER SHIPPED (order.shipped)
   ✓ Published shipment for ORD-001
   → Will be received by: notifications & shipping queues

4️⃣ Publishing ANOTHER NEW ORDER (order.created)
   ✓ Published order ORD-002
   → Will be received by: processing & notifications queues

5️⃣ Publishing URGENT ORDER UPDATE (order.updated.urgent)
   ✓ Published urgent update for ORD-002
   → Will be received by: notifications & urgent queues
```

**Worker Output:**

```
Subscribed to:
  • order.created     → processOrder handler
  • order.#           → notifyOrder handler (all events)
  • order.shipped     → shipOrder handler
  • order.*.urgent    → handleUrgentOrder handler

[PROCESSING] New order received (ORD-001)
[NOTIFICATIONS] Event received (new_order: ORD-001)
[NOTIFICATIONS] Event received (status_update: ORD-001)
[SHIPPING] Shipment notification received (ORD-001)
[NOTIFICATIONS] Event received (new_order: ORD-002)
[PROCESSING] New order received (ORD-002)
[URGENT] Priority order update received! (ORD-002)
[NOTIFICATIONS] Event received (status_update: ORD-002)
```

## Contract Definition

The contract is defined in a separate package (`@amqp-contract-samples/basic-order-processing-contract`) that is shared between the client and worker.

### Message Schemas

**Order Schema** (for new orders):

```typescript
const orderSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })),
  totalAmount: z.number().positive(),
  createdAt: z.string().datetime(),
});
```

**Order Status Schema** (for updates):

```typescript
const orderStatusSchema = z.object({
  orderId: z.string(),
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
  updatedAt: z.string().datetime(),
});
```

### Contract Structure

```typescript
export const orderContract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  queues: {
    orderProcessing: defineQueue('order-processing', { durable: true }),
    orderNotifications: defineQueue('order-notifications', { durable: true }),
    orderShipping: defineQueue('order-shipping', { durable: true }),
    orderUrgent: defineQueue('order-urgent', { durable: true }),
  },
  bindings: {
    orderProcessingBinding: defineBinding('order-processing', 'orders', {
      routingKey: 'order.created',
    }),
    orderNotificationsBinding: defineBinding('order-notifications', 'orders', {
      routingKey: 'order.#',
    }),
    orderShippingBinding: defineBinding('order-shipping', 'orders', {
      routingKey: 'order.shipped',
    }),
    orderUrgentBinding: defineBinding('order-urgent', 'orders', {
      routingKey: 'order.*.urgent',
    }),
  },
  publishers: {
    orderCreated: definePublisher('orders', orderSchema, {
      routingKey: 'order.created',
    }),
    orderUpdated: definePublisher('orders', orderStatusSchema, {
      routingKey: 'order.updated',
    }),
    orderShipped: definePublisher('orders', orderStatusSchema, {
      routingKey: 'order.shipped',
    }),
    orderUrgentUpdate: definePublisher('orders', orderStatusSchema, {
      routingKey: 'order.updated.urgent',
    }),
  },
  consumers: {
    processOrder: defineConsumer('order-processing', orderSchema, {
      prefetch: 10,
    }),
    notifyOrder: defineConsumer('order-notifications', z.union([orderSchema, orderStatusSchema]), {
      prefetch: 5,
    }),
    shipOrder: defineConsumer('order-shipping', orderStatusSchema, {
      prefetch: 5,
    }),
    handleUrgentOrder: defineConsumer('order-urgent', orderStatusSchema, {
      prefetch: 20,
    }),
  },
});
```

## Client Implementation

The client is in a separate package (`@amqp-contract-samples/basic-order-processing-client`) that imports the contract:

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { orderContract } from '@amqp-contract-samples/basic-order-processing-contract';

const connection = await connect('amqp://localhost');
const client = await TypedAmqpClient.create({ contract: orderContract, connection });

// Publish new order
await client.publish('orderCreated', {
  orderId: 'ORD-001',
  customerId: 'CUST-123',
  items: [
    { productId: 'PROD-A', quantity: 2, price: 29.99 },
  ],
  totalAmount: 59.98,
  createdAt: new Date().toISOString(),
});

// Publish status update
await client.publish('orderUpdated', {
  orderId: 'ORD-001',
  status: 'processing',
  updatedAt: new Date().toISOString(),
});
```

## Worker Implementation

The worker is in a separate package (`@amqp-contract-samples/basic-order-processing-worker`) that imports the contract:

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { orderContract } from '@amqp-contract-samples/basic-order-processing-contract';

const connection = await connect('amqp://localhost');

const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: async (message) => {
      console.log(`[PROCESSING] Order ${message.orderId}`);
      console.log(`  Customer: ${message.customerId}`);
      console.log(`  Total: $${message.totalAmount}`);
    },

    notifyOrder: async (message) => {
      console.log(`[NOTIFICATION] Order ${message.orderId} event`);
    },

    shipOrder: async (message) => {
      console.log(`[SHIPPING] Order ${message.orderId} - ${message.status}`);
    },

    handleUrgentOrder: async (message) => {
      console.log(`[URGENT] Order ${message.orderId} - ${message.status}`);
    },
  },
  connection,
});
```

## Message Routing Table

| Message Published | Routing Key            | Queues Receiving                              | Handlers Triggered               |
| ----------------- | ---------------------- | --------------------------------------------- | -------------------------------- |
| New Order         | `order.created`        | ✅ order-processing<br>✅ order-notifications | processOrder<br>notifyOrder      |
| Regular Update    | `order.updated`        | ✅ order-notifications                        | notifyOrder                      |
| Shipped Order     | `order.shipped`        | ✅ order-notifications<br>✅ order-shipping   | notifyOrder<br>shipOrder         |
| Urgent Update     | `order.updated.urgent` | ✅ order-notifications<br>✅ order-urgent     | notifyOrder<br>handleUrgentOrder |

## Key Takeaways

1. **Flexible Routing** - Topic patterns enable complex routing without code changes
2. **Type Safety** - TypeScript ensures correctness at compile time
3. **Validation** - Zod validates all messages at runtime
4. **Decoupling** - Publishers don't need to know about consumers
5. **Scalability** - Easy to add new routing patterns

## Source Code

The complete source code is available in the repository:

- [Contract](https://github.com/btravers/amqp-contract/tree/main/samples/basic-order-processing-contract)
- [Client](https://github.com/btravers/amqp-contract/tree/main/samples/basic-order-processing-client)
- [Worker](https://github.com/btravers/amqp-contract/tree/main/samples/basic-order-processing-worker)

## Next Steps

- Try modifying the routing keys
- Add new publishers or consumers
- Explore [AsyncAPI Generation](/examples/asyncapi-generation)
- Learn about [Client Usage](/guide/client-usage) and [Worker Usage](/guide/worker-usage)
