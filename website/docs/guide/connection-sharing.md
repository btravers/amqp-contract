# Connection Sharing Guide

## Overview

When an application uses both the AMQP client (for publishing) and worker (for consuming), you can share a single connection between them following RabbitMQ best practices. This guide explains how to implement connection sharing using the low-level API.

## Why Share Connections?

According to [RabbitMQ best practices](https://www.rabbitmq.com/connections.html):

- **Connections are expensive**: TCP connection, TLS handshake, authentication, and heartbeat overhead
- **Channels are lightweight**: Multiplexed over a single connection
- **Best practice**: Share one connection, use multiple channels

### Benefits

1. **Resource Efficiency**: One TCP connection instead of two
2. **Reduced Overhead**: Single authentication and heartbeat loop
3. **Better Scalability**: Lower connection count in large deployments
4. **Cost Savings**: ~50ms startup time improvement, ~5-10MB memory savings per service

## Usage

### Basic Connection Sharing

```typescript
import { AmqpClient } from '@amqp-contract/core';
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

// 1. Create a shared AmqpClient
const sharedAmqpClient = new AmqpClient(contract, {
  urls: ['amqp://localhost'],
  connectionOptions: {
    heartbeatIntervalInSeconds: 30,
  },
});

// 2. Create client with shared connection
const clientResult = await TypedAmqpClient.create({
  contract,
  amqpClient: sharedAmqpClient, // ← Share the connection
});

if (clientResult.isError()) {
  throw clientResult.error;
}
const client = clientResult.value;

// 3. Create worker with same shared connection
const workerResult = await TypedAmqpWorker.create({
  contract,
  amqpClient: sharedAmqpClient, // ← Share the same connection
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);
      
      // Can publish from within consumer using shared client
      const publishResult = await client.publish('orderProcessed', {
        orderId: message.orderId,
        status: 'completed',
      });
      
      publishResult.match({
        Ok: () => console.log('Order processed event published'),
        Error: (error) => console.error('Failed to publish:', error),
      });
    },
  },
});

if (workerResult.isError()) {
  throw workerResult.error;
}
const worker = workerResult.value;

// Both client and worker now share a single connection! ✅
// Result: 1 connection, 2 channels
```

### Lifecycle Management

When using shared connections, the lifecycle management is important:

```typescript
// The AmqpClient owns the connection
const sharedAmqpClient = new AmqpClient(contract, { urls: ['amqp://localhost'] });

// Create client and worker
const client = (await TypedAmqpClient.create({ contract, amqpClient: sharedAmqpClient })).get();
const worker = (await TypedAmqpWorker.create({ 
  contract, 
  amqpClient: sharedAmqpClient,
  handlers: { /* ... */ },
})).get();

// Close in reverse order
// 1. Close worker first (stops consuming)
await worker.close();

// 2. Close client (stops publishing)
await client.close();

// 3. Close shared connection (closes the underlying TCP connection)
await sharedAmqpClient.close();
```

**Important**: Only the `AmqpClient` that created the connection should call `close()` on it. Clients and workers created with `amqpClient` option will only close their own channels, not the shared connection.

### Without Connection Sharing (Before)

```typescript
// ❌ Creates two separate connections
const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
});

const worker = await TypedAmqpWorker.create({
  contract,
  urls: ['amqp://localhost'],
  handlers: { /* ... */ },
});

// Result: 2 connections, 2 channels
// - More resource usage
// - More network overhead
// - Slower startup
```

### With Connection Sharing (After)

```typescript
// ✅ Shares a single connection
const sharedAmqpClient = new AmqpClient(contract, {
  urls: ['amqp://localhost'],
});

const client = await TypedAmqpClient.create({
  contract,
  amqpClient: sharedAmqpClient,
});

const worker = await TypedAmqpWorker.create({
  contract,
  amqpClient: sharedAmqpClient,
  handlers: { /* ... */ },
});

// Result: 1 connection, 2 channels ✅
// - Less resource usage
// - Less network overhead
// - Faster startup
```

## Advanced Patterns

### Multiple Clients Sharing One Connection

You can create multiple clients and workers sharing the same connection:

```typescript
const sharedAmqpClient = new AmqpClient(contract, { urls: ['amqp://localhost'] });

// Create multiple clients
const orderClient = await TypedAmqpClient.create({ 
  contract: orderContract, 
  amqpClient: sharedAmqpClient,
});

const notificationClient = await TypedAmqpClient.create({ 
  contract: notificationContract, 
  amqpClient: sharedAmqpClient,
});

// Create workers
const orderWorker = await TypedAmqpWorker.create({ 
  contract: orderContract, 
  amqpClient: sharedAmqpClient,
  handlers: { /* ... */ },
});

const notificationWorker = await TypedAmqpWorker.create({ 
  contract: notificationContract, 
  amqpClient: sharedAmqpClient,
  handlers: { /* ... */ },
});

// All share one connection with 4 separate channels
```

### Connection from Existing Client

You can also get the connection from an existing client:

```typescript
// Create first client
const client1 = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
});

// Get the underlying AmqpClient and its connection
const sharedConnection = client1.amqpClient.getConnection();

// Create second client using the shared connection
const sharedAmqpClient = AmqpClient.fromConnection(contract, sharedConnection);
const client2 = await TypedAmqpClient.create({
  contract,
  amqpClient: sharedAmqpClient,
});

// Both clients now share the same connection
```

## When to Use Connection Sharing

### ✅ Use Connection Sharing When:

- Your application both publishes and consumes messages
- You have multiple microservices in the same process
- You want to optimize resource usage
- You're following RabbitMQ best practices

### ❌ Don't Use Connection Sharing When:

- You only publish OR only consume (not both)
- Clients/workers are in different processes
- You need complete isolation between components
- The added complexity isn't worth the benefits for your use case

## Performance Impact

### Startup Time

- **Before**: ~100-200ms per connection
- **After**: ~50ms (shared connection)
- **Savings**: ~50-150ms per service

### Memory Usage

- **Before**: ~5-10 MB per connection
- **After**: ~5-10 MB total (shared)
- **Savings**: ~5-10 MB per hybrid service

### Scalability

**Scenario**: 100 microservices, 50% are hybrid (both publish and consume)

- **Before**: 150 connections (100 single-purpose + 50×2 hybrid)
- **After**: 100 connections (100 single-purpose + 50 hybrid)
- **Improvement**: 33% reduction in connection count

## Backward Compatibility

Connection sharing is **completely backward compatible**:

```typescript
// Old code still works - no breaking changes
const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
});

const worker = await TypedAmqpWorker.create({
  contract,
  urls: ['amqp://localhost'],
  handlers: { /* ... */ },
});

// New code with connection sharing
const sharedAmqpClient = new AmqpClient(contract, { urls: ['amqp://localhost'] });

const client2 = await TypedAmqpClient.create({
  contract,
  amqpClient: sharedAmqpClient, // ← New optional parameter
});

const worker2 = await TypedAmqpWorker.create({
  contract,
  amqpClient: sharedAmqpClient, // ← New optional parameter
  handlers: { /* ... */ },
});
```

## Troubleshooting

### Connection is closed unexpectedly

Make sure you close clients/workers before closing the shared `AmqpClient`:

```typescript
// ✅ Correct order
await worker.close();  // Close worker first
await client.close();   // Close client second
await sharedAmqpClient.close();  // Close shared connection last

// ❌ Wrong order - can cause errors
await sharedAmqpClient.close();  // Closes connection immediately
await client.close();   // Will fail - connection already closed
await worker.close();   // Will fail - connection already closed
```

### Multiple connections created

Make sure you're passing the same `AmqpClient` instance:

```typescript
// ❌ Creates two separate AmqpClients
const client = await TypedAmqpClient.create({
  contract,
  amqpClient: new AmqpClient(contract, { urls: ['amqp://localhost'] }),
});
const worker = await TypedAmqpWorker.create({
  contract,
  amqpClient: new AmqpClient(contract, { urls: ['amqp://localhost'] }),
  handlers: { /* ... */ },
});

// ✅ Shares the same AmqpClient
const sharedAmqpClient = new AmqpClient(contract, { urls: ['amqp://localhost'] });
const client = await TypedAmqpClient.create({
  contract,
  amqpClient: sharedAmqpClient,
});
const worker = await TypedAmqpWorker.create({
  contract,
  amqpClient: sharedAmqpClient,
  handlers: { /* ... */ },
});
```

## Related Documentation

- [Architecture Decision Record: Connection Sharing Strategy](/adr/003-connection-sharing)
- [Client Usage Guide](/guide/client-usage)
- [Worker Usage Guide](/guide/worker-usage)
- [RabbitMQ Connection Best Practices](https://www.rabbitmq.com/connections.html)
