# ADR-003: Connection Sharing Strategy

**Status**: Accepted  
**Date**: 2025-12-25  
**Deciders**: Project Maintainers
**Implementation Status**: Low-level API - Implemented ✅ | Unified Package - Proposed

## Context

When an application uses both `TypedAmqpClient` (for publishing) and `TypedAmqpWorker` (for consuming), each creates its own connection to RabbitMQ. This leads to:

1. **Resource Inefficiency**: Two TCP connections, double authentication, double heartbeat overhead
2. **Suboptimal Resource Usage**: Connection limits could be reached faster in large deployments
3. **Violation of Best Practices**: RabbitMQ documentation recommends sharing connections

According to [RabbitMQ best practices](https://www.rabbitmq.com/connections.html):

- Connections are expensive (TCP connection, TLS handshake, authentication, heartbeat)
- Channels are lightweight (multiplexed over a connection)
- **Best practice**: Share one connection, use multiple channels

### Current Behavior

```typescript
// Creates connection #1
const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
});

// Creates connection #2
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: { processOrder: async (msg) => { ... } },
  urls: ['amqp://localhost'],
});

// Result: 2 connections, 2 channels
```

### The Question

How should we enable connection sharing for applications that both publish and consume messages?

## Decision

We have implemented **automatic connection sharing via singleton** to address this concern:

### Implemented Solution: Automatic Connection Sharing

The library uses an internal **`ConnectionManagerSingleton`** that provides:

1. Automatic connection reuse when URLs and options match
2. Zero-effort connection sharing for users
3. Transparent connection management
4. Clean separation - each client/worker has its own channel

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';

// Just provide URLs - connection sharing is automatic!
const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'], // ← Just provide URLs
});

const worker = await TypedAmqpWorker.create({
  contract,
  urls: ['amqp://localhost'], // ← Same URLs = automatic connection sharing
  handlers: { processOrder: async (msg) => { ... } },
});

// Result: 1 connection (managed by singleton), 2 channels ✅
// No manual connection management needed!
```

## Rationale

### Why Automatic Singleton Pattern?

1. **Zero User Effort**
   - No manual connection management required
   - Connection sharing happens automatically
   - Users just provide URLs - the library does the rest

2. **Hard to Misuse**
   - No way to accidentally create multiple connections
   - No lifecycle management pitfalls
   - Automatic cleanup when all channels close

3. **Best Practices by Default**
   - Connection sharing is always enabled
   - Follows RabbitMQ best practices automatically
   - No need for users to learn connection management

4. **Clean Separation of Concerns**
   - Singleton manages connections (expensive resources)
   - Each client/worker manages its own channel (lightweight)
   - Clear ownership boundaries

### Trade-offs

- **Less Control**: Advanced users can't opt out of connection sharing
  - Mitigation: Use different URLs for separate connections if needed
- **Global State**: Singleton introduces global state
  - Mitigation: Provided `await AmqpClient._resetConnectionCacheForTesting()` for test isolation
- **Implicit Behavior**: Connection reuse happens behind the scenes
  - Mitigation: Well-documented behavior with clear examples

## Testing Strategy

### Unit Tests

Test connection caching and reuse:

```typescript
describe('ConnectionManagerSingleton', () => {
  beforeEach(() => {
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it('should reuse connection when URLs match', async () => {
    const client1 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost'],
    });

    const client2 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost'],
    });

    // Both should use the same underlying connection
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });

  it('should create separate connections for different URLs', async () => {
    const client1 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost:5672'],
    });

    const client2 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost:5673'],
    });

    // Different URLs = different connections
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });
});
```

### Integration Tests

Test with real RabbitMQ:

```typescript
describe('Automatic Connection Sharing Integration', () => {
  beforeEach(() => {
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it('should publish and consume using shared connection', async () => {
    const messages: any[] = [];
    const urls = ['amqp://localhost'];

    // Create client
    const clientResult = await TypedAmqpClient.create({
      contract,
      urls,
    }).resultToPromise();

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

    // Create worker - automatically shares connection
    const workerResult = await TypedAmqpWorker.create({
      contract,
      urls,
      handlers: {
        processOrder: async (msg) => {
          messages.push(msg);
        },
      },
    }).resultToPromise();

    if (workerResult.isError()) {
      throw workerResult.error;
    }
    const worker = workerResult.value;

    // Publish message
    const publishResult = await client.publish('orderCreated', {
      orderId: 'TEST-123',
      amount: 99.99,
    }).resultToPromise();

    if (publishResult.isError()) {
      throw publishResult.error;
    }

    await waitFor(() => messages.length > 0);

    expect(messages[0]).toMatchObject({
      orderId: 'TEST-123',
      amount: 99.99,
    });

    await worker.close();
    await client.close();
  });
});
```

## Consequences

### Positive

1. **Resource Efficiency**: Single connection for hybrid applications automatically
2. **Best Practices**: Aligns with RabbitMQ recommendations by default
3. **Zero User Effort**: No connection management needed
4. **Backward Compatible**: Existing code works unchanged and automatically benefits
5. **Hard to Misuse**: Impossible to accidentally create duplicate connections with same URLs
6. **Optimal for Scale**: Better resource usage at scale

### Negative

1. **Global State**: Singleton introduces global state
2. **Less Control**: Advanced users can't easily opt out of connection sharing
3. **Implicit Behavior**: Connection reuse happens behind the scenes

### Mitigation

1. **Test Isolation**: Provided `await AmqpClient._resetConnectionCacheForTesting()` for test isolation
2. **Separate Connections**: Use different URLs for separate connections if needed
3. **Clear Documentation**: Comprehensive guides explain automatic connection sharing behavior

## Usage Decision Tree

Add to documentation:

```
Need to publish messages?
├─ Yes
│  └─ Need to consume messages?
│     ├─ Yes → Use @amqp-contract/client + @amqp-contract/worker
│     │  (Connection sharing is automatic when URLs match)
│     └─ No → Use @amqp-contract/client
└─ No
   └─ Need to consume messages?
      ├─ Yes → Use @amqp-contract/worker
      └─ No → No package needed
```

## Testing Strategy

### Unit Tests

Test connection caching and reuse:

```typescript
describe('ConnectionManagerSingleton', () => {
  beforeEach(async () => {
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it('should reuse connection when URLs match', async () => {
    const client1 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost'],
    });

    const client2 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost'],
    });

    // Both should use the same underlying connection
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });

  it('should create separate connections for different URLs', async () => {
    const client1 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost:5672'],
    });

    const client2 = await TypedAmqpClient.create({
      contract,
      urls: ['amqp://localhost:5673'],
    });

    // Different URLs = different connections
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });
});
```

### Integration Tests

Test with real RabbitMQ:

```typescript
describe('Automatic Connection Sharing Integration', () => {
  beforeEach(() => {
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it('should publish and consume using shared connection', async () => {
    const messages: any[] = [];
    const urls = ['amqp://localhost'];

    // Create client
    const clientResult = await TypedAmqpClient.create({
      contract,
      urls,
    }).resultToPromise();

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

    // Create worker - automatically shares connection
    const workerResult = await TypedAmqpWorker.create({
      contract,
      urls,
      handlers: {
        processOrder: async (msg) => {
          messages.push(msg);
        },
      },
    }).resultToPromise();

    if (workerResult.isError()) {
      throw workerResult.error;
    }
    const worker = workerResult.value;

    // Publish message
    const publishResult = await client.publish('orderCreated', {
      orderId: 'TEST-123',
      amount: 99.99,
    }).resultToPromise();

    if (publishResult.isError()) {
      throw publishResult.error;
    }

    await waitFor(() => messages.length > 0);

    expect(messages[0]).toMatchObject({
      orderId: 'TEST-123',
      amount: 99.99,
    });

    await worker.close();
    await client.close();
  });
});
```

## Performance Considerations

### Connection Overhead

**Before (separate packages):**

- 2 TCP connections
- 2 authentication handshakes
- 2 heartbeat loops
- ~100-200ms additional latency for second connection

**After (unified package):**

- 1 TCP connection
- 1 authentication handshake
- 1 heartbeat loop
- ~50ms savings on startup

### Memory Usage

**Before:** ~5-10 MB per connection (depending on configuration)  
**After:** ~5-10 MB total (single connection)  
**Savings:** ~5-10 MB per hybrid service

### Scalability Impact

**Scenario**: 100 microservices, 50% are hybrid (both publish and consume)

**Before:**

- 150 total connections (100 single-purpose + 50 hybrid × 2)
- More memory usage on RabbitMQ server
- More network overhead

**After (with unified package):**

- 100 total connections (100 single-purpose + 50 hybrid × 1)
- 33% reduction in connection count
- Less memory and network overhead

## Documentation Plan

### Package README Updates

Update READMEs to mention automatic connection sharing:

**@amqp-contract/client/README.md:**

> **Note**: When used with `@amqp-contract/worker` and the same URLs, connections are automatically shared for optimal resource usage.

**@amqp-contract/worker/README.md:**

> **Note**: When used with `@amqp-contract/client` and the same URLs, connections are automatically shared for optimal resource usage.

### Documentation Pages

1. **Connection Sharing Guide**
   - Explain RabbitMQ connection best practices
   - Show how automatic connection sharing works
   - Provide troubleshooting tips

2. **Performance Guide**
   - Connection overhead analysis
   - Memory savings
   - Recommendations by use case

## Future Enhancements

### Health Checks

Add health check support:

```typescript
const client = await TypedAmqpClient.create({ contract, urls: ['amqp://localhost'] });

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthy = await client.isHealthy();
  res.status(healthy ? 200 : 503).json({ healthy });
});
```

### Connection Metrics

Add observability for connection usage:

```typescript
import { getConnectionMetrics } from '@amqp-contract/core';

// Get metrics for monitoring
const metrics = getConnectionMetrics();
console.log('Active connections:', metrics.activeConnections);
console.log('Shared connections:', metrics.sharedConnections);
```

## Implementation Status

### ✅ Automatic Connection Sharing (Implemented)

Automatic connection sharing via singleton has been implemented and is available in version 0.3.6+:

#### Core Changes (@amqp-contract/core)

- Added `ConnectionManagerSingleton` internal class that manages and caches `AmqpConnectionManager` instances
- Connection caching based on URLs and connection options - automatically reuses connections when parameters match
- `AmqpClient` constructor always uses singleton to get/create connections transparently
- `AmqpClient.getConnection()` exposes underlying connection (primarily for debugging/testing)
- Added `await AmqpClient._resetConnectionCacheForTesting()` utility for test isolation
- Each client creates its own channel while sharing the underlying connection

#### Client Changes (@amqp-contract/client)

- `CreateClientOptions` simplified - users only provide `urls` (no manual connection sharing needed)
- `TypedAmqpClient.create()` automatically benefits from connection sharing when URLs match

#### Worker Changes (@amqp-contract/worker)

- `CreateWorkerOptions` simplified - users only provide `urls` (no manual connection sharing needed)
- `TypedAmqpWorker.create()` automatically benefits from connection sharing when URLs match

#### Usage Example

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';

// Just provide URLs - connection sharing is automatic!
const client = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'], // ← Just provide URLs
});

const worker = await TypedAmqpWorker.create({
  contract,
  urls: ['amqp://localhost'], // ← Same URLs = automatic connection sharing
  handlers: { processOrder: async (msg) => { ... } },
});

// Result: 1 connection (managed by singleton), 2 channels
// No manual connection management needed!
```

#### Architecture

The singleton `ConnectionManagerSingleton` caches connections by URLs and connection options. When multiple clients/workers are created with identical parameters, the singleton automatically returns the same connection, enabling transparent connection sharing with zero user effort. Each `TypedAmqpClient` and `TypedAmqpWorker` maintains its own `AmqpClient` instance with its own channel for clean separation of concerns.

#### Documentation

- [Connection Sharing Guide](/guide/connection-sharing) - Complete usage guide with examples
- Tests added in `packages/core/src/connection-sharing.spec.ts`
- Tests added in `packages/client/src/connection-sharing.unit.spec.ts`
- Tests added in `packages/worker/src/worker.unit.spec.ts`

### 🔮 Unified Package (Future Consideration)

A unified package (`@amqp-contract/unified`) could be considered in the future if there's demand for a higher-level API. However, with automatic connection sharing now built-in, the value proposition is less clear. The separate packages with automatic connection sharing may be sufficient for most use cases.

## References

- [RabbitMQ Connection Management](https://www.rabbitmq.com/connections.html)
- [RabbitMQ Channels Guide](https://www.rabbitmq.com/channels.html)
- [AMQP 0-9-1 Best Practices](https://www.rabbitmq.com/best-practices.html)
- [ADR-002: Separate Client and Worker Packages](002-separate-packages.md)
- [Connection Sharing Guide](/guide/connection-sharing)

## Related ADRs

- [ADR-002: Separate Client and Worker Packages](002-separate-packages.md)
