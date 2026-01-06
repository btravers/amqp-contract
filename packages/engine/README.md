# @amqp-contract/engine

Core engine abstraction layer for amqp-contract, enabling support for multiple messaging protocols.

## Overview

This package provides the core interfaces and types that allow amqp-contract to work with different messaging engines beyond AMQP/RabbitMQ. By implementing these interfaces, you can create adapters for:

- **AMQP/RabbitMQ** (reference implementation in `@amqp-contract/engine-amqp`)
- **Apache Kafka**
- **BullMQ** (Redis-based queues)
- **Redis Pub/Sub**
- **Custom messaging systems**

## Key Concepts

### MessageEngine Interface

The `MessageEngine` interface defines the core operations for publishing and consuming messages:

- **Connection Management**: `connect()`, `disconnect()`, `waitForReady()`
- **Publishing**: `publish()` - send messages to exchanges/topics
- **Consuming**: `consume()`, `cancel()` - receive messages from queues
- **Monitoring**: `getStatus()`, `getMetrics()`

### TopologyEngine Interface

The `TopologyEngine` interface handles resource setup and management:

- **Exchanges/Topics**: `assertExchange()`, `deleteExchange()`
- **Queues**: `assertQueue()`, `deleteQueue()`
- **Bindings**: `bindQueue()`, `unbindQueue()`

### Protocol-Agnostic Types

The package provides protocol-agnostic type definitions that map to concepts across different messaging systems:

- `ExchangeDefinition` → AMQP exchanges, Kafka topics, Redis channels
- `QueueDefinition` → AMQP queues, Kafka consumer groups, Bull queues
- `BindingDefinition` → Queue-to-exchange bindings, topic subscriptions

## Installation

```bash
pnpm add @amqp-contract/engine
```

## Usage

### Implementing a Custom Engine

```typescript
import type { MessageEngine, ConnectionConfig, PublishableMessage } from "@amqp-contract/engine";
import { Future, Result } from "@swan-io/boxed";

class MyCustomEngine implements MessageEngine {
  async connect(config: ConnectionConfig): Future<Result<void, Error>> {
    // Implement connection logic
    return Future.value(Result.Ok(undefined));
  }

  async publish(
    exchange: string,
    message: PublishableMessage,
    options?: PublishOptions,
  ): Future<Result<void, Error>> {
    // Implement publish logic
    return Future.value(Result.Ok(undefined));
  }

  // ... implement other methods
}
```

### Using with amqp-contract

```typescript
import { TypedAmqpClient } from "@amqp-contract/client";
import { MyCustomEngine } from "./my-custom-engine";

const client = await TypedAmqpClient.create({
  contract,
  engine: new MyCustomEngine(),
  urls: ["custom://localhost"],
});
```

## Engine Implementations

### Official Implementations

- **@amqp-contract/engine-amqp** - AMQP/RabbitMQ engine (reference implementation)

### Community Implementations

- Coming soon! Create your own and submit a PR to be listed here.

## Type Safety

All engine interfaces use TypeScript to ensure type safety and provide excellent IDE support:

- Full type inference from contract definitions
- Compile-time checks for message schemas
- Runtime validation with Standard Schema v1

## Contributing

We welcome engine implementations for other messaging protocols! Please see:

- [Implementation Guide](../../docs/guide/implementing-engines.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)

## License

MIT
