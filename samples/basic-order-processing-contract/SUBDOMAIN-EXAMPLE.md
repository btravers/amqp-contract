# Contract Subdomain Pattern Example

This example demonstrates how to split a large AMQP contract into logical subdomains and merge them together using `mergeContracts`.

## Overview

The example shows a microservices architecture split into three main subdomains:

1. **Order Subdomain** - Handles order creation and processing
2. **Payment Subdomain** - Handles payment processing
3. **Notification Subdomain** - Handles email and SMS notifications
4. **Shared Infrastructure** - Common dead letter exchange/queue

Each subdomain has its own contract with:
- Exchanges
- Queues
- Bindings
- Publishers
- Consumers

## Benefits

### 1. Modular Architecture
Each subdomain can be developed, tested, and maintained independently:

```typescript
// Order team owns this
export const orderContract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  // ... rest of order domain
});

// Payment team owns this
export const paymentContract = defineContract({
  exchanges: { payments: paymentsExchange },
  queues: { paymentProcessing: paymentProcessingQueue },
  // ... rest of payment domain
});
```

### 2. Team Ownership
Different teams can own and evolve their contracts independently:
- Order team maintains `orderContract`
- Payment team maintains `paymentContract`
- Platform team maintains `sharedInfraContract`

### 3. Reusability
Shared infrastructure can be defined once and reused:

```typescript
const sharedInfraContract = defineContract({
  exchanges: {
    deadLetter: defineExchange('dlx', 'topic', { durable: true }),
  },
  queues: {
    deadLetterQueue: defineQueue('dlq', { durable: true }),
  },
});
```

### 4. Better Testing
Test each subdomain in isolation:

```typescript
// Test only the order subdomain
const orderClient = await TypedAmqpClient.create({
  contract: orderContract,
  connection: 'amqp://localhost'
});

// Or test the full application
const fullClient = await TypedAmqpClient.create({
  contract: applicationContract,
  connection: 'amqp://localhost'
});
```

## Merging Contracts

All subdomains are merged into a single application contract:

```typescript
export const applicationContract = mergeContracts(
  sharedInfraContract,
  orderContract,
  paymentContract,
  notificationContract,
);
```

The merged contract:
- Contains all exchanges, queues, bindings, publishers, and consumers from all subdomains
- Provides end-to-end type safety across all domains
- Can be used with `TypedAmqpClient` and `TypedAmqpWorker`

## Conflict Handling

When merging contracts with the same resource name, later contracts override earlier ones:

```typescript
const contract1 = defineContract({
  exchanges: {
    shared: defineExchange('my-exchange', 'topic', { durable: true }),
  },
});

const contract2 = defineContract({
  exchanges: {
    shared: defineExchange('my-exchange', 'direct', { durable: false }),
  },
});

const merged = mergeContracts(contract1, contract2);
// merged.exchanges.shared will be the 'direct' exchange from contract2
```

**Best Practice**: Use unique prefixes or namespaces to avoid naming conflicts:
- `order_exchange`, `payment_exchange`, `notification_exchange`
- Or organize by subdomain in the naming: `orders`, `payments`, `notifications`

## Usage

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { applicationContract } from './subdomain-example';

// Create client with merged contract
const client = await TypedAmqpClient.create({
  contract: applicationContract,
  connection: 'amqp://localhost'
});

// All publishers from all subdomains are available with type safety
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  customerId: 'CUST-456',
  amount: 99.99,
  createdAt: new Date().toISOString(),
});

await client.publish('paymentReceived', {
  paymentId: 'PAY-789',
  orderId: 'ORD-123',
  amount: 99.99,
  method: 'credit_card',
  processedAt: new Date().toISOString(),
});

// Create worker with merged contract
const worker = await TypedAmqpWorker.create({
  contract: applicationContract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);
    },
    processPayment: async (message) => {
      console.log('Processing payment:', message.paymentId);
    },
    processEmail: async (message) => {
      console.log('Sending email to:', message.recipientEmail);
    },
    processSms: async (message) => {
      console.log('Sending SMS to:', message.recipientId);
    },
  },
  connection: 'amqp://localhost'
});
```

## File Structure

```
src/
├── subdomain-example.ts    # Main example with subdomain contracts
└── index.ts                # Original contract
```

## See Also

- [Contract API Documentation](https://btravers.github.io/amqp-contract/api/contract)
- [Getting Started Guide](https://btravers.github.io/amqp-contract/guide/getting-started)
- [Core Concepts](https://btravers.github.io/amqp-contract/guide/core-concepts)
