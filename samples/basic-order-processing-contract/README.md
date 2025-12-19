# Basic Order Processing Contract

This package contains the shared contract definition for the order processing sample.

## Purpose

The contract serves as the **single source of truth** for:

- Message schemas and types
- Exchange and queue definitions
- Routing key patterns
- Publisher and consumer definitions

This package is used by both the client and worker applications, ensuring consistency and type safety across the entire system.

## Package Structure

The contract package structure:

- `src/contract/index.ts` - Contract definition with schemas, exchanges, queues, bindings
- `src/integration.spec.ts` - Integration tests using testcontainers

## RabbitMQ Topic Pattern

This sample demonstrates the **topic exchange pattern**, which allows flexible message routing based on routing keys with wildcards.

### Topic Exchange Routing Diagram

```
                                    ┌─────────────────┐
                                    │  Topic Exchange │
                                    │    "orders"     │
                                    └────────┬────────┘
                                             │
                        ┌────────────────────┼────────────────────┐
                        │                    │                    │
                        │                    │                    │
         order.created  │     order.#        │   order.shipped    │  order.*.urgent
                        │                    │                    │
                        ▼                    ▼                    ▼
              ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
              │ order-processing │  │order-notifications│  │  order-shipping  │
              │      Queue       │  │      Queue        │  │      Queue       │
              └────────┬─────────┘  └────────┬──────────┘  └────────┬─────────┘
                       │                     │                       │
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

### Routing Keys Used

- `order.created` - New orders
- `order.updated` - Regular status updates
- `order.shipped` - Shipped orders
- `order.*.urgent` - Urgent updates (wildcard pattern)

### Message Routing Table

| Message Published | Routing Key            | Queues Receiving Message                      |
| ----------------- | ---------------------- | --------------------------------------------- |
| New Order         | `order.created`        | ✅ order-processing<br>✅ order-notifications |
| Regular Update    | `order.updated`        | ✅ order-notifications                        |
| Shipped Order     | `order.shipped`        | ✅ order-notifications<br>✅ order-shipping   |
| Another New Order | `order.created`        | ✅ order-processing<br>✅ order-notifications |
| Urgent Update     | `order.updated.urgent` | ✅ order-notifications<br>✅ order-urgent     |

### Routing Key Patterns Explained

#### Exact Match

- `order.created` → matches only `order.created` messages
- `order.shipped` → matches only `order.shipped` messages

#### Multiple Word Wildcard (`#`)

- `order.#` → matches zero or more words after "order."
  - ✅ Matches: `order.created`, `order.updated`, `order.shipped`, `order.updated.urgent`
  - This is used by the notifications queue to receive ALL order events

#### Multi-Level Pattern (`order.*.urgent`)

- `order.*.urgent` → matches any single word between "order." and ".urgent"
  - ✅ Matches: `order.created.urgent`, `order.updated.urgent`, `order.shipped.urgent`
  - ❌ Does NOT match: `order.created`, `order.updated` (missing ".urgent")

### Example Message Flows

#### Publishing `order.created`

```
Publisher → order.created → Topic Exchange
                           ↓
              ┌────────────┴────────────┐
              ↓                         ↓
    order-processing          order-notifications
    (exact match)             (order.# matches)
              ↓                         ↓
      processOrder()              notifyOrder()
```

#### Publishing `order.updated.urgent`

```
Publisher → order.updated.urgent → Topic Exchange
                                  ↓
                    ┌─────────────┴─────────────┐
                    ↓                           ↓
         order-notifications              order-urgent
         (order.# matches)                (order.*.urgent matches)
                    ↓                           ↓
              notifyOrder()              handleUrgentOrder()
```

## Prerequisites

- RabbitMQ running on `localhost:5672` (or set `AMQP_URL` environment variable)

You can start RabbitMQ with Docker:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

## Running the Sample

1. Build the packages:

```bash
pnpm build
```

2. Start the worker (in one terminal):

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev
```

3. Run the client/publisher (in another terminal):

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

You'll see the worker receiving and processing messages based on the routing keys!

## Running Tests

Integration tests use testcontainers to automatically spin up a RabbitMQ instance:

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-contract test
```

## Contract Definition

### Message Schemas

**Order Schema** (for new orders):

```typescript
{
  orderId: string
  customerId: string
  items: Array<{
    productId: string
    quantity: number
    price: number
  }>
  totalAmount: number
  createdAt: string (ISO datetime)
}
```

**Order Status Schema** (for updates):

```typescript
{
  orderId: string
  status: "processing" | "shipped" | "delivered" | "cancelled"
  updatedAt: string (ISO datetime)
}
```

### Exchanges

- `orders` - Topic exchange with durable flag

### Queues

- `order-processing` - Receives new orders (`order.created`)
- `order-notifications` - Receives all order events (`order.#`)
- `order-shipping` - Receives shipped orders (`order.shipped`)
- `order-urgent` - Receives urgent updates (`order.*.urgent`)

### Publishers

- `orderCreated` - Publishes new orders
- `orderUpdated` - Publishes regular updates
- `orderShipped` - Publishes shipping events
- `orderUrgentUpdate` - Publishes urgent updates

### Consumers

- `processOrder` - Processes new orders
- `notifyOrder` - Sends notifications for all events
- `shipOrder` - Handles shipping
- `handleUrgentOrder` - Handles urgent updates

## Key Benefits

1. **Flexible Routing**: Messages route to queues based on patterns, not hardcoded bindings
2. **Selective Consumption**: Each consumer only receives relevant messages
3. **Scalability**: Easy to add new routing patterns without changing existing code
4. **Decoupling**: Publishers don't need to know about consumers
5. **Wildcards**: Use `*` (one word) or `#` (zero or more words) for flexible pattern matching

## Key Features Demonstrated

✅ **Modular Architecture**: Separation of contract, client, and worker  
✅ **RabbitMQ Topic Pattern**: Flexible routing with wildcards  
✅ **Type-safe Publishing**: Compile-time type checking for messages  
✅ **Type-safe Consumption**: Handlers receive correctly typed messages  
✅ **Automatic Validation**: Zod schema validation for all messages  
✅ **Multiple Consumers**: Different queues subscribe to different patterns  
✅ **Routing Key Patterns**: Wildcards for flexible subscriptions  
✅ **Code Reusability**: Contract shared between client and worker  
✅ **Integration Testing**: Testcontainers for automated testing
