# ADR-003: Connection Sharing Strategy

**Status**: Proposed  
**Date**: 2024-12-25  
**Deciders**: Project Maintainers

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

We will implement **multiple complementary approaches** to address this concern:

### Primary Solution: Unified Package (Proposed)

Create a new **@amqp-contract/unified** package that provides:

1. Single connection shared between publisher and consumer
2. Convenient API for hybrid applications
3. Automatic lifecycle management

> **Note**: This is a proposed future implementation. The following code examples illustrate the intended design but are not yet implemented.

```typescript
// PROPOSED IMPLEMENTATION - NOT YET AVAILABLE
import { TypedAmqpUnifiedClient } from '@amqp-contract/unified';

const unified = await TypedAmqpUnifiedClient.create({
  contract,
  publishers: true,
  consumers: {
    handlers: {
      processOrder: async (message) => { ... },
    },
  },
  urls: ['amqp://localhost'],
});

// Publish messages
await unified.publisher.publish('orderCreated', { ... });

// Consumers are automatically started

// Close everything (closes shared connection)
await unified.close();

// Result: 1 connection, 2 channels ✅
```

### Secondary Solution: Low-Level API (Proposed)

Add support for passing an existing `AmqpClient` instance to both `TypedAmqpClient` and `TypedAmqpWorker`:

> **Note**: This is a proposed enhancement to the existing API. The following examples show the intended design.

```typescript
// PROPOSED ENHANCEMENT - NOT YET AVAILABLE
import { AmqpClient } from '@amqp-contract/core';

// Create shared AmqpClient
const amqpClient = new AmqpClient(contract, {
  urls: ['amqp://localhost'],
});

// Pass to client
const client = await TypedAmqpClient.create({
  contract,
  amqpClient, // ← Use existing client
});

// Pass to worker
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: { ... },
  amqpClient, // ← Use same client
});

// Result: 1 connection, 2 channels ✅
```

## Rationale

### Why Both Solutions?

1. **Unified Package (High-Level)**
   - **Target**: Most users who need both publishing and consuming
   - **Benefit**: Convenient, automatic, hard to misuse
   - **Trade-off**: Additional package

2. **Low-Level API**
   - **Target**: Advanced users who need fine-grained control
   - **Benefit**: Maximum flexibility, minimal API surface
   - **Trade-off**: More boilerplate, easier to misuse

### Why Not Just One?

- High-level API alone: Doesn't serve advanced use cases
- Low-level API alone: Too much boilerplate for common cases
- Both together: Covers all use cases with appropriate abstraction levels

## Implementation: Unified Package (Proposed)

> **Important**: The following sections describe a proposed implementation design. This package does not yet exist. These details serve as a reference for future implementation and may be adjusted based on actual development needs.

### Package Structure

```
packages/unified/
├── src/
│   ├── unified-client.ts      # TypedAmqpUnifiedClient
│   ├── types.ts               # Type definitions
│   ├── errors.ts              # Error classes
│   └── index.ts               # Public API
├── package.json
├── README.md
└── vitest.config.ts
```

### Core Implementation (Proposed)

> **Note**: This section describes a proposed implementation design. When implementing this ADR, the actual implementation should be verified against the existing `AmqpClient` API and adjusted as needed.

```typescript
// PROPOSED IMPLEMENTATION - packages/unified/src/unified-client.ts
// This is a design sketch showing the intended architecture
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { AmqpClient, type Logger } from '@amqp-contract/core';
import type { ConnectionUrl, AmqpConnectionManagerOptions } from 'amqp-connection-manager';
import type { ContractDefinition } from '@amqp-contract/contract';
import type { WorkerInferConsumerHandlers } from '@amqp-contract/worker';
import { Future, Result } from '@swan-io/boxed';
import { TechnicalError } from './errors.js';

/**
 * Options for creating a unified client that can both publish and consume
 */
export type CreateUnifiedClientOptions<TContract extends ContractDefinition> = {
  /** The AMQP contract definition */
  contract: TContract;
  /** Enable publishing. Default: true */
  publishers?: boolean;
  /** Configure consumers with handlers */
  consumers?: {
    handlers: WorkerInferConsumerHandlers<TContract>;
  };
  /** AMQP broker URL(s) */
  urls: ConnectionUrl[];
  /** Optional connection configuration */
  connectionOptions?: AmqpConnectionManagerOptions;
  /** Optional logger */
  logger?: Logger;
};

/**
 * Unified client that shares a single connection for both publishing and consuming
 */
export class TypedAmqpUnifiedClient<TContract extends ContractDefinition> {
  private constructor(
    private readonly amqpClient: AmqpClient,
    private readonly _publisher?: TypedAmqpClient<TContract>,
    private readonly _consumer?: TypedAmqpWorker<TContract>,
  ) {}

  /**
   * Create a unified client with shared connection
   */
  static create<TContract extends ContractDefinition>({
    contract,
    publishers = true,
    consumers,
    urls,
    connectionOptions,
    logger,
  }: CreateUnifiedClientOptions<TContract>): Future<
    Result<TypedAmqpUnifiedClient<TContract>, TechnicalError>
  > {
    // Create shared AmqpClient
    const amqpClient = new AmqpClient(contract, { urls, connectionOptions });

    // Create publisher if enabled
    const publisherFuture = publishers
      ? TypedAmqpClient.create({ contract, amqpClient, logger })
      : Future.value(Result.Ok(undefined));

    // Create consumer if configured
    const consumerFuture = consumers
      ? TypedAmqpWorker.create({
          contract,
          handlers: consumers.handlers,
          amqpClient,
          logger,
        })
      : Future.value(Result.Ok(undefined));

    // Wait for both to initialize
    return Future.all([publisherFuture, consumerFuture]).map(
      ([publisherResult, consumerResult]) => {
        if (publisherResult.isError()) {
          return Result.Error(publisherResult.error);
        }
        if (consumerResult.isError()) {
          return Result.Error(consumerResult.error);
        }

        return Result.Ok(
          new TypedAmqpUnifiedClient(
            amqpClient,
            publisherResult.value,
            consumerResult.value,
          ),
        );
      },
    );
  }

  /**
   * Get the publisher instance
   * @throws {Error} If publishers were not enabled
   */
  get publisher(): TypedAmqpClient<TContract> {
    if (!this._publisher) {
      throw new Error('Publishers not enabled in unified client configuration');
    }
    return this._publisher;
  }

  /**
   * Get the consumer instance
   * @throws {Error} If consumers were not configured
   */
  get consumer(): TypedAmqpWorker<TContract> {
    if (!this._consumer) {
      throw new Error('Consumers not configured in unified client configuration');
    }
    return this._consumer;
  }

  /**
   * Close the unified client (closes shared connection and all channels)
   */
  async close(): Promise<Result<void, TechnicalError>> {
    try {
      // Close publisher and consumer
      await Promise.all([
        this._publisher?.close().resultToPromise(),
        this._consumer?.close().resultToPromise(),
      ]);

      // Close shared connection
      await this.amqpClient.close();

      return Result.Ok(undefined);
    } catch (error) {
      return Result.Error(
        new TechnicalError('Failed to close unified client', error),
      );
    }
  }
}
```

### Usage Examples (Proposed)

> **Note**: These examples show the intended usage patterns. Code is illustrative and not yet implemented.

#### Example 1: Full Hybrid Service

```typescript
// PROPOSED USAGE - NOT YET AVAILABLE
import { TypedAmqpUnifiedClient } from '@amqp-contract/unified';
import { contract } from './contract';

const unified = await TypedAmqpUnifiedClient.create({
  contract,
  publishers: true,
  consumers: {
    handlers: {
      processOrder: async (message) => {
        console.log('Processing order:', message.orderId);

        // Can publish from within consumer
        await unified.publisher.publish('orderProcessed', {
          orderId: message.orderId,
          status: 'completed',
        });
      },
    },
  },
  urls: ['amqp://localhost'],
});

// Publish from main flow
const result = await unified.publisher.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

result.match({
  Ok: () => console.log('Published'),
  Error: (error) => console.error('Failed:', error),
});
```

#### Example 2: Publish-Only (Using Unified)

```typescript
const unified = await TypedAmqpUnifiedClient.create({
  contract,
  publishers: true,
  consumers: undefined, // No consumers
  urls: ['amqp://localhost'],
});

await unified.publisher.publish('orderCreated', { ... });
```

#### Example 3: Consume-Only (Using Unified)

```typescript
const unified = await TypedAmqpUnifiedClient.create({
  contract,
  publishers: false, // Disable publishers
  consumers: {
    handlers: {
      processOrder: async (message) => { ... },
    },
  },
  urls: ['amqp://localhost'],
});

// No publisher available
// unified.publisher would throw
```

## Implementation: Low-Level API (Proposed)

> **Important**: The following sections describe proposed enhancements to the existing API. These changes have not yet been implemented.

### Add `amqpClient` Option

Extend both `CreateClientOptions` and `CreateWorkerOptions`:

```typescript
// PROPOSED ENHANCEMENT - packages/client/src/client.ts
export type CreateClientOptions<TContract extends ContractDefinition> =
  | {
      contract: TContract;
      urls: ConnectionUrl[];
      connectionOptions?: AmqpConnectionManagerOptions;
      logger?: Logger;
    }
  | {
      contract: TContract;
      amqpClient: AmqpClient;
      logger?: Logger;
    };
```

```typescript
// PROPOSED ENHANCEMENT - packages/worker/src/worker.ts
export type CreateWorkerOptions<TContract extends ContractDefinition> =
  | {
      contract: TContract;
      handlers: WorkerInferConsumerHandlers<TContract>;
      urls: ConnectionUrl[];
      connectionOptions?: AmqpConnectionManagerOptions;
      logger?: Logger;
    }
  | {
      contract: TContract;
      handlers: WorkerInferConsumerHandlers<TContract>;
      amqpClient: AmqpClient;
      logger?: Logger;
    };
```

### Update Create Methods

```typescript
static create<TContract extends ContractDefinition>(
  options: CreateClientOptions<TContract>
): Future<Result<TypedAmqpClient<TContract>, TechnicalError>> {
  const amqpClient = 'amqpClient' in options
    ? options.amqpClient
    : new AmqpClient(options.contract, {
        urls: options.urls,
        connectionOptions: options.connectionOptions,
      });

  const client = new TypedAmqpClient(
    options.contract,
    amqpClient,
    options.logger,
  );

  return client.waitForConnectionReady().mapOk(() => client);
}
```

## Consequences

### Positive

1. **Resource Efficiency**: Single connection for hybrid applications
2. **Best Practices**: Aligns with RabbitMQ recommendations
3. **Flexibility**: Multiple approaches for different use cases
4. **Backward Compatible**: Existing code continues to work
5. **Clear Migration Path**: Users can adopt unified package when ready
6. **Optimal for Scale**: Better resource usage at scale

### Negative

1. **Additional Package**: Increases maintenance burden
2. **Documentation Complexity**: Need to explain three usage patterns
3. **Choice Overload**: Users need to understand which approach to use
4. **Potential Confusion**: May not be clear when to use each approach

### Mitigation

1. **Clear Documentation**: Provide decision tree for package selection
2. **Examples**: Show all three patterns with use cases
3. **Defaults**: Make unified package the recommended default for hybrid services
4. **Migration Guide**: Help users move to unified package

## Usage Decision Tree

Add to documentation:

```
Need to publish messages?
├─ Yes
│  └─ Need to consume messages?
│     ├─ Yes → Use @amqp-contract/unified ⭐ (recommended)
│     │  Or use both @amqp-contract/client + @amqp-contract/worker
│     └─ No → Use @amqp-contract/client
└─ No
   └─ Need to consume messages?
      ├─ Yes → Use @amqp-contract/worker
      └─ No → No package needed
```

## Testing Strategy

### Unit Tests

Test each class independently:

```typescript
describe('TypedAmqpUnifiedClient', () => {
  it('should create with both publishers and consumers', async () => {
    const unified = await TypedAmqpUnifiedClient.create({
      contract,
      publishers: true,
      consumers: { handlers: { processOrder: vi.fn() } },
      urls: ['amqp://localhost'],
    }).resultToPromise();

    expect(unified.publisher).toBeDefined();
    expect(unified.consumer).toBeDefined();
  });

  it('should throw when accessing disabled publisher', async () => {
    const unified = await TypedAmqpUnifiedClient.create({
      contract,
      publishers: false,
      consumers: { handlers: { processOrder: vi.fn() } },
      urls: ['amqp://localhost'],
    }).resultToPromise();

    expect(() => unified.publisher).toThrow(
      'Publishers not enabled in unified client configuration'
    );
  });

  it('should share single connection', async () => {
    // Implementation test - verify connection reuse
  });
});
```

### Integration Tests

Test with real RabbitMQ:

```typescript
describe('Unified Client Integration', () => {
  it('should publish and consume using shared connection', async () => {
    const messages: any[] = [];

    const unified = await TypedAmqpUnifiedClient.create({
      contract,
      publishers: true,
      consumers: {
        handlers: {
          processOrder: async (msg) => {
            messages.push(msg);
          },
        },
      },
      urls: ['amqp://localhost'],
    }).resultToPromise();

    await unified.publisher.publish('orderCreated', {
      orderId: 'TEST-123',
      amount: 99.99,
    }).resultToPromise();

    await waitFor(() => messages.length > 0);

    expect(messages[0]).toMatchObject({
      orderId: 'TEST-123',
      amount: 99.99,
    });

    await unified.close();
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

Update READMEs to mention connection sharing:

**@amqp-contract/client/README.md:**

> **Note**: If your application also consumes messages, consider using `@amqp-contract/unified` for optimized connection sharing.

**@amqp-contract/worker/README.md:**

> **Note**: If your application also publishes messages, consider using `@amqp-contract/unified` for optimized connection sharing.

### New Documentation Pages

1. **Connection Management Guide**
   - Explain RabbitMQ connection best practices
   - Show all three usage patterns
   - Provide decision tree

2. **Unified Package Guide**
   - Complete API documentation
   - Usage examples
   - Migration guide from separate packages

3. **Performance Guide**
   - Benchmark results
   - Connection overhead analysis
   - Recommendations by use case

## Future Enhancements

### Connection Pooling

For very high-throughput applications:

```typescript
const pool = await createConnectionPool({
  contract,
  urls: ['amqp://localhost'],
  poolSize: 5,
});

const client = await pool.getClient();
const worker = await pool.getWorker();
```

### Health Checks

Add health check support:

```typescript
const unified = await TypedAmqpUnifiedClient.create({ ... });

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthy = await unified.isHealthy();
  res.status(healthy ? 200 : 503).json({ healthy });
});
```

## References

- [RabbitMQ Connection Management](https://www.rabbitmq.com/connections.html)
- [RabbitMQ Channels Guide](https://www.rabbitmq.com/channels.html)
- [AMQP 0-9-1 Best Practices](https://www.rabbitmq.com/best-practices.html)
- [ADR-002: Separate Client and Worker Packages](./002-separate-packages.md)

## Related ADRs

- [ADR-002: Separate Client and Worker Packages](./002-separate-packages.md)
