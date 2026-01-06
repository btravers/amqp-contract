# Implementing Custom Engines

This guide explains how to implement a custom engine for amqp-contract, enabling support for messaging systems beyond AMQP/RabbitMQ.

## Overview

An engine is an adapter that implements the `MessageEngine` and `TopologyEngine` interfaces from `@amqp-contract/engine`. It translates the protocol-agnostic operations into protocol-specific API calls for your messaging system.

## Architecture

```
┌──────────────────────────────────────┐
│         Your Application             │
│  (Uses @amqp-contract/client/worker) │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│      @amqp-contract/engine           │
│    (Abstract interfaces & types)     │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│      Your Engine Implementation      │
│     (Implements MessageEngine)       │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│    Protocol-Specific Client Library  │
│  (e.g., kafkajs, bullmq, ioredis)    │
└──────────────────────────────────────┘
```

## Step-by-Step Implementation

### 1. Create Package Structure

```
packages/engine-myprotocol/
├── src/
│   ├── engine.ts          # Main engine implementation
│   ├── topology.ts        # Topology setup (optional)
│   ├── types.ts           # Protocol-specific types
│   ├── errors.ts          # Custom error classes
│   ├── index.ts           # Public API
│   └── __tests__/         # Tests
│       └── engine.spec.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### 2. Install Dependencies

```json
{
  "name": "@amqp-contract/engine-myprotocol",
  "dependencies": {
    "@amqp-contract/engine": "workspace:*",
    "@swan-io/boxed": "catalog:",
    "my-protocol-client": "^1.0.0"
  },
  "devDependencies": {
    "@amqp-contract/tsconfig": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

### 3. Implement MessageEngine Interface

```typescript
// src/engine.ts
import type {
  FullMessageEngine,
  ConnectionConfig,
  PublishableMessage,
  PublishOptions,
  MessageHandler,
  ConsumeOptions,
  EngineStatus,
  EngineMetrics,
  ExchangeDefinition,
  QueueDefinition,
  BindingDefinition,
} from "@amqp-contract/engine";
import { Future, Result } from "@swan-io/boxed";
import { MyProtocolClient } from "my-protocol-client";

export class MyProtocolEngine implements FullMessageEngine {
  private client?: MyProtocolClient;
  private status: EngineStatus = "disconnected";
  private metrics: EngineMetrics = {
    messagesPublished: 0,
    messagesConsumed: 0,
    messagesFailed: 0,
    status: "disconnected",
  };

  async connect(config: ConnectionConfig): Future<Result<void, Error>> {
    try {
      this.status = "connecting";
      this.client = new MyProtocolClient({
        brokers: config.urls,
        ...config.options,
      });
      await this.client.connect();
      this.status = "connected";
      this.metrics.status = "connected";
      return Future.value(Result.Ok(undefined));
    } catch (error) {
      this.status = "error";
      this.metrics.status = "error";
      return Future.value(
        Result.Error(error instanceof Error ? error : new Error("Connection failed")),
      );
    }
  }

  async disconnect(): Future<Result<void, Error>> {
    try {
      await this.client?.disconnect();
      this.status = "disconnected";
      this.metrics.status = "disconnected";
      return Future.value(Result.Ok(undefined));
    } catch (error) {
      return Future.value(
        Result.Error(error instanceof Error ? error : new Error("Disconnect failed")),
      );
    }
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  async waitForReady(timeoutMs: number = 10000): Future<Result<void, Error>> {
    const startTime = Date.now();
    while (this.status !== "connected") {
      if (Date.now() - startTime > timeoutMs) {
        return Future.value(Result.Error(new Error("Connection timeout")));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return Future.value(Result.Ok(undefined));
  }

  async publish(
    exchange: string,
    message: PublishableMessage,
    options?: PublishOptions,
  ): Future<Result<void, Error>> {
    if (!this.client) {
      return Future.value(Result.Error(new Error("Client not connected")));
    }

    try {
      // Map abstract message to protocol-specific format
      await this.client.send({
        topic: exchange, // Map exchange → topic
        key: message.routingKey,
        value: JSON.stringify(message.payload),
        headers: message.properties?.headers,
      });

      this.metrics.messagesPublished++;
      return Future.value(Result.Ok(undefined));
    } catch (error) {
      this.metrics.messagesFailed++;
      return Future.value(
        Result.Error(error instanceof Error ? error : new Error("Publish failed")),
      );
    }
  }

  async consume(
    queue: string,
    handler: MessageHandler,
    options?: ConsumeOptions,
  ): Future<Result<string, Error>> {
    if (!this.client) {
      return Future.value(Result.Error(new Error("Client not connected")));
    }

    try {
      // Map abstract queue to protocol-specific consumer
      const consumer = await this.client.subscribe({
        groupId: queue, // Map queue → consumer group
        topics: [queue],
        autoCommit: options?.autoAck ?? true,
      });

      consumer.on("message", async (rawMessage) => {
        try {
          // Transform protocol message to abstract format
          const message = {
            payload: JSON.parse(rawMessage.value),
            properties: {
              messageId: rawMessage.key,
              timestamp: rawMessage.timestamp,
              headers: rawMessage.headers,
            },
            raw: rawMessage,
          };

          // Provide acknowledgment interface
          const ack = {
            ack: async () => {
              await consumer.commitOffsets([
                {
                  topic: rawMessage.topic,
                  partition: rawMessage.partition,
                  offset: rawMessage.offset,
                },
              ]);
            },
            nack: async (requeue?: boolean) => {
              // Handle nack based on protocol capabilities
            },
            reject: async (requeue?: boolean) => {
              // Handle reject based on protocol capabilities
            },
          };

          await handler(message, ack);
          this.metrics.messagesConsumed++;
        } catch (error) {
          this.metrics.messagesFailed++;
          console.error("Message handling error:", error);
        }
      });

      const consumerTag = `${queue}-${Date.now()}`;
      return Future.value(Result.Ok(consumerTag));
    } catch (error) {
      return Future.value(
        Result.Error(error instanceof Error ? error : new Error("Consume failed")),
      );
    }
  }

  async cancel(consumerTag: string): Future<Result<void, Error>> {
    // Implement consumer cancellation
    return Future.value(Result.Ok(undefined));
  }

  getMetrics(): EngineMetrics {
    return { ...this.metrics };
  }

  // TopologyEngine methods
  async assertExchange(exchange: ExchangeDefinition): Future<Result<void, Error>> {
    // Create topic/exchange if supported by protocol
    return Future.value(Result.Ok(undefined));
  }

  async assertQueue(queue: QueueDefinition): Future<Result<void, Error>> {
    // Create queue/consumer group if supported by protocol
    return Future.value(Result.Ok(undefined));
  }

  async bindQueue(binding: BindingDefinition): Future<Result<void, Error>> {
    // Create binding/subscription if supported by protocol
    return Future.value(Result.Ok(undefined));
  }

  async deleteExchange(exchange: string): Future<Result<void, Error>> {
    return Future.value(Result.Ok(undefined));
  }

  async deleteQueue(queue: string): Future<Result<void, Error>> {
    return Future.value(Result.Ok(undefined));
  }

  async unbindQueue(binding: BindingDefinition): Future<Result<void, Error>> {
    return Future.value(Result.Ok(undefined));
  }
}
```

### 4. Export Public API

```typescript
// src/index.ts
export { MyProtocolEngine } from "./engine.js";
export type { MyProtocolOptions } from "./types.js";
```

### 5. Write Tests

```typescript
// src/__tests__/engine.spec.ts
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { MyProtocolEngine } from "../engine.js";

describe("MyProtocolEngine", () => {
  let engine: MyProtocolEngine;

  beforeEach(() => {
    engine = new MyProtocolEngine();
  });

  afterEach(async () => {
    await engine.disconnect().resultToPromise();
  });

  describe("connect", () => {
    it("should connect successfully", async () => {
      const result = await engine
        .connect({
          urls: ["myprotocol://localhost"],
          protocol: "custom",
        })
        .resultToPromise();

      expect(result.isOk()).toBe(true);
      expect(engine.getStatus()).toBe("connected");
    });
  });

  describe("publish", () => {
    it("should publish message", async () => {
      await engine
        .connect({
          urls: ["myprotocol://localhost"],
          protocol: "custom",
        })
        .resultToPromise();

      const result = await engine
        .publish("test-exchange", {
          routingKey: "test.key",
          payload: { message: "hello" },
        })
        .resultToPromise();

      expect(result.isOk()).toBe(true);
    });
  });
});
```

## Protocol Mapping Guidelines

### Concepts Mapping

Map abstract concepts to your protocol's equivalents:

| Abstract Concept | AMQP        | Kafka          | Redis Pub/Sub | BullMQ    |
| ---------------- | ----------- | -------------- | ------------- | --------- |
| Exchange         | Exchange    | Topic          | Channel       | Queue     |
| Queue            | Queue       | Consumer Group | Subscription  | Job Queue |
| Binding          | Binding     | Subscription   | Subscribe     | N/A       |
| Routing Key      | Routing Key | Partition Key  | N/A           | Job ID    |
| Message          | Message     | Record         | Message       | Job       |
| Consumer Tag     | Consumer    | Consumer ID    | Subscriber ID | Worker ID |

### Handling Protocol Differences

Different protocols have varying capabilities. Here's how to handle common scenarios:

#### 1. Missing Features

If your protocol doesn't support a feature:

```typescript
async assertExchange(exchange: ExchangeDefinition): Future<Result<void, Error>> {
  if (exchange.type !== "fanout") {
    return Future.value(
      Result.Error(
        new Error(`${this.protocol} only supports fanout-style exchanges`)
      )
    );
  }
  // ... implementation
}
```

#### 2. Different Semantics

Document semantic differences:

```typescript
/**
 * Note: Redis Pub/Sub does not support message persistence.
 * The durable flag is ignored for Redis channels.
 */
async assertExchange(exchange: ExchangeDefinition): Future<Result<void, Error>> {
  if (exchange.durable) {
    console.warn(
      `Warning: Redis does not support durable channels. ` +
      `Messages will not be persisted.`
    );
  }
  // ... implementation
}
```

#### 3. Best-Effort Implementation

Provide reasonable defaults:

```typescript
async consume(
  queue: string,
  handler: MessageHandler,
  options?: ConsumeOptions
): Future<Result<string, Error>> {
  // Redis doesn't have built-in prefetch, simulate with batching
  const prefetch = options?.prefetch ?? 1;
  // ... implementation with simulated prefetch
}
```

## Best Practices

### 1. Error Handling

Provide clear, actionable error messages:

```typescript
if (!this.client) {
  return Future.value(
    Result.Error(new Error("Engine not connected. Call connect() before publishing messages.")),
  );
}
```

### 2. Logging

Use the logger if provided:

```typescript
constructor(private logger?: Logger) {}

async publish(...): Future<Result<void, Error>> {
  this.logger?.debug("Publishing message", { exchange, routingKey });
  // ... implementation
}
```

### 3. Metrics

Track meaningful metrics:

```typescript
getMetrics(): EngineMetrics {
  return {
    ...this.metrics,
    // Protocol-specific metrics
    connectionPoolSize: this.client?.poolSize ?? 0,
    activeConsumers: this.consumers.size,
  };
}
```

### 4. Resource Cleanup

Ensure proper cleanup:

```typescript
async disconnect(): Future<Result<void, Error>> {
  // Cancel all consumers
  for (const [tag, consumer] of this.consumers.entries()) {
    await consumer.stop();
  }
  this.consumers.clear();

  // Close connections
  await this.client?.disconnect();

  return Future.value(Result.Ok(undefined));
}
```

## Testing Your Engine

### Unit Tests

Test each method in isolation:

```typescript
describe("MyProtocolEngine", () => {
  it("should handle connection failure", async () => {
    const engine = new MyProtocolEngine();
    const result = await engine
      .connect({ urls: ["invalid://url"], protocol: "custom" })
      .resultToPromise();

    expect(result.isError()).toBe(true);
  });
});
```

### Integration Tests

Test with actual broker (using testcontainers):

```typescript
import { GenericContainer } from "testcontainers";

describe("MyProtocolEngine Integration", () => {
  let container: StartedTestContainer;
  let engine: MyProtocolEngine;

  beforeAll(async () => {
    container = await new GenericContainer("my-protocol:latest").withExposedPorts(9092).start();
  });

  afterAll(async () => {
    await container.stop();
  });

  it("should publish and consume messages", async () => {
    // Test full flow
  });
});
```

## Documentation

Create comprehensive documentation:

### README.md

```markdown
# @amqp-contract/engine-myprotocol

Engine implementation for MyProtocol messaging system.

## Installation

\`\`\`bash
pnpm add @amqp-contract/engine-myprotocol
\`\`\`

## Usage

\`\`\`typescript
import { MyProtocolEngine } from "@amqp-contract/engine-myprotocol";
import { TypedAmqpClient } from "@amqp-contract/client";

const client = await TypedAmqpClient.create({
contract,
engine: new MyProtocolEngine(),
urls: ["myprotocol://localhost"],
});
\`\`\`

## Supported Features

- ✅ Publishing messages
- ✅ Consuming messages
- ✅ Topic creation
- ⚠️ Limited routing (fanout only)
- ❌ Persistent messages (not supported by protocol)

## Protocol Mapping

| Abstract | MyProtocol |
| -------- | ---------- |
| Exchange | Channel    |
| Queue    | Consumer   |
| Binding  | Subscribe  |

## Known Limitations

- Messages are not persisted
- No transaction support
- Limited to fanout-style routing
```

## Example Engines

### Reference Implementations

Study these engines for guidance:

1. **@amqp-contract/engine-amqp** - AMQP/RabbitMQ (reference implementation)
2. **@amqp-contract/engine-kafka** - Apache Kafka (future)
3. **@amqp-contract/engine-bullmq** - BullMQ/Redis (future)

## Support

For questions or issues:

1. Check existing engine implementations
2. Review [ADR-004: Engine Abstraction](../adr/004-engine-abstraction.md)
3. Open a GitHub discussion
4. Submit an issue

## Contributing

We welcome engine implementations for new protocols! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
