# ADR 004: Engine Abstraction Layer

## Status

Proposed

## Context

The amqp-contract library is currently tightly coupled to AMQP/RabbitMQ through direct usage of `amqplib` and `amqp-connection-manager`. While this works well for AMQP use cases, it limits the library's applicability to other messaging systems that are compatible with AsyncAPI specifications, such as:

- **Apache Kafka** - Event streaming platform
- **BullMQ** - Redis-based job queue
- **Redis Pub/Sub** - Simple message broker
- **NATS** - Cloud-native messaging system
- **AWS SQS/SNS** - Managed message queues
- **Google Cloud Pub/Sub** - Managed messaging
- **Azure Service Bus** - Enterprise messaging

All these systems share similar concepts (publishers, consumers, topics/queues, routing) but have different APIs and semantics. The goal is to abstract these differences behind a unified interface while maintaining type safety and the excellent developer experience that amqp-contract provides.

## Decision

We will introduce an **engine abstraction layer** that decouples the contract definition and type system from the underlying messaging protocol implementation.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    @amqp-contract/contract                   │
│          (Protocol-agnostic contract definitions)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     @amqp-contract/engine                    │
│              (Core interfaces and type definitions)          │
│                                                              │
│  • MessageEngine interface                                   │
│  • TopologyEngine interface                                  │
│  • Protocol-agnostic types                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ engine-amqp  │  │ engine-kafka │  │engine-bullmq │
    │   (AMQP/     │  │  (Apache     │  │   (Redis     │
    │  RabbitMQ)   │  │   Kafka)     │  │   Queues)    │
    └──────────────┘  └──────────────┘  └──────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │    client    │  │    worker    │  │  asyncapi    │
    │              │  │              │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
    ┌──────────────┐  ┌──────────────┐
    │client-nestjs │  │worker-nestjs │
    │              │  │              │
    └──────────────┘  └──────────────┘
```

### Core Interfaces

#### MessageEngine

The `MessageEngine` interface defines the runtime operations for message publishing and consuming:

```typescript
export type MessageEngine = {
  connect(config: ConnectionConfig): Future<Result<void, Error>>;
  disconnect(): Future<Result<void, Error>>;
  getStatus(): EngineStatus;
  waitForReady(timeoutMs?: number): Future<Result<void, Error>>;
  publish(
    exchange: string,
    message: PublishableMessage,
    options?: PublishOptions,
  ): Future<Result<void, Error>>;
  consume(
    queue: string,
    handler: MessageHandler,
    options?: ConsumeOptions,
  ): Future<Result<string, Error>>;
  cancel(consumerTag: string): Future<Result<void, Error>>;
  getMetrics(): EngineMetrics;
};
```

#### TopologyEngine

The `TopologyEngine` interface handles resource setup and management:

```typescript
export type TopologyEngine = {
  assertExchange(exchange: ExchangeDefinition): Future<TopologySetupResult>;
  assertQueue(queue: QueueDefinition): Future<TopologySetupResult>;
  bindQueue(binding: BindingDefinition): Future<TopologySetupResult>;
  deleteExchange(exchange: string): Future<TopologySetupResult>;
  deleteQueue(queue: string): Future<TopologySetupResult>;
  unbindQueue(binding: BindingDefinition): Future<TopologySetupResult>;
};
```

### Protocol-Agnostic Types

The engine layer provides protocol-agnostic type definitions that map across different messaging systems:

- `ExchangeDefinition` → AMQP exchanges, Kafka topics, Redis channels, SQS queues
- `QueueDefinition` → AMQP queues, Kafka consumer groups, Bull queues, SQS queues
- `BindingDefinition` → Queue-to-exchange bindings, topic subscriptions, routing rules

### Implementation Strategy

1. **Phase 1: Core Abstraction (COMPLETE)** ✅
   - Create `@amqp-contract/engine` package with interfaces and types
   - Define protocol-agnostic abstractions
   - Add comprehensive tests

2. **Phase 2: AMQP Engine Implementation**
   - Create `@amqp-contract/engine-amqp` package
   - Extract AMQP logic from `@amqp-contract/core`
   - Implement `MessageEngine` and `TopologyEngine` for AMQP
   - Maintain backward compatibility

3. **Phase 3: Update Consumer Packages**
   - Update `@amqp-contract/client` to accept engine parameter
   - Update `@amqp-contract/worker` to accept engine parameter
   - Maintain backward compatibility by defaulting to AMQP engine

4. **Phase 4: NestJS Integration**
   - Add engine configuration to NestJS modules
   - Support pluggable engines via dependency injection

5. **Phase 5: Additional Engines**
   - Implement engines for other protocols (Kafka, BullMQ, etc.)
   - Community contributions welcome

## Consequences

### Positive

1. **Protocol Flexibility**: Library can support multiple messaging systems beyond AMQP
2. **Better Separation of Concerns**: Core contracts are decoupled from implementation
3. **Extensibility**: New engines can be added without changing core packages
4. **Type Safety Maintained**: Full TypeScript type inference still works
5. **AsyncAPI Compatible**: Aligns with AsyncAPI's protocol-agnostic approach
6. **Community Contributions**: External developers can create engines for new protocols

### Negative

1. **Increased Complexity**: More abstraction layers to understand
2. **Additional Packages**: More packages to maintain in the monorepo
3. **Migration Path**: Existing users need guidance for migration
4. **Performance Overhead**: Additional abstraction might add minimal overhead
5. **Breaking Changes**: Some changes required to fully implement abstraction

### Neutral

1. **Backward Compatibility Strategy**: Default to AMQP engine for existing code
2. **Gradual Migration**: Can be implemented incrementally
3. **Documentation Burden**: Requires comprehensive guides for engine implementers

## Migration Path for Existing Users

### No Changes Required (Backward Compatible)

Existing code will continue to work without modifications:

```typescript
// This still works exactly as before
const client = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
});
```

The AMQP engine will be used by default when no engine is specified.

### Explicit Engine Configuration (New API)

Users can explicitly choose an engine:

```typescript
import { AmqpEngine } from "@amqp-contract/engine-amqp";
import { KafkaEngine } from "@amqp-contract/engine-kafka";

// AMQP
const client = await TypedAmqpClient.create({
  contract,
  engine: new AmqpEngine(),
  urls: ["amqp://localhost"],
});

// Kafka
const client = await TypedAmqpClient.create({
  contract,
  engine: new KafkaEngine(),
  urls: ["kafka://localhost:9092"],
});
```

## Implementation Guidelines

### Creating a New Engine

To implement an engine for a new protocol:

1. **Create Engine Package**

   ```
   packages/engine-myprotocol/
   ├── src/
   │   ├── engine.ts          # MessageEngine implementation
   │   ├── topology.ts        # TopologyEngine implementation
   │   ├── types.ts           # Protocol-specific types
   │   └── index.ts           # Public API
   ├── package.json
   └── README.md
   ```

2. **Implement Core Interfaces**

   ```typescript
   import type { FullMessageEngine } from "@amqp-contract/engine";

   export class MyProtocolEngine implements FullMessageEngine {
     // Implement all methods
   }
   ```

3. **Map Protocol Concepts**
   - Exchange → Your protocol's equivalent (topic, channel, etc.)
   - Queue → Your protocol's equivalent (consumer group, queue, etc.)
   - Binding → Your protocol's subscription/routing mechanism

4. **Handle Protocol Differences**
   - Document unsupported features
   - Provide sensible defaults
   - Throw meaningful errors for incompatible operations

## Testing Strategy

1. **Engine Interface Tests**: Validate interface implementations
2. **Integration Tests**: Test with actual message brokers (using testcontainers)
3. **Contract Tests**: Ensure engines honor the contract abstraction
4. **Backward Compatibility Tests**: Verify existing code works unchanged

## Documentation Requirements

1. **Engine Implementation Guide**: How to create new engines
2. **Migration Guide**: Transitioning from direct AMQP to engine abstraction
3. **Protocol Mapping Guide**: How different protocols map to abstractions
4. **Best Practices**: Recommendations for engine implementers

## Future Enhancements

1. **Engine Registry**: Central registry for discovering available engines
2. **Engine Adapters**: Adapters for bridging between protocols
3. **Multi-Engine Support**: Using multiple engines in one application
4. **Protocol Detection**: Automatic engine selection based on URL scheme
5. **Performance Benchmarks**: Compare engine performance characteristics

## Related Decisions

- [ADR 001: Client-Worker Terminology](./001-client-worker-terminology.md)
- [ADR 002: Separate Packages](./002-separate-packages.md)
- [ADR 003: Connection Sharing](./003-connection-sharing.md)

## References

- [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
- [Standard Schema v1](https://github.com/standard-schema/standard-schema)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
