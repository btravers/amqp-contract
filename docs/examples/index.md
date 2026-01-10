# Examples

Explore practical examples of using amqp-contract.

## Available Examples

### [Basic Order Processing](/examples/basic-order-processing)

A complete example demonstrating:

- Contract definition with exchanges, queues, and bindings
- Type-safe message publishing
- Type-safe message consuming
- Multiple consumers (pub/sub pattern)

**Technologies:** [RabbitMQ](https://www.rabbitmq.com/) • TypeScript • [Zod](https://zod.dev/)

## Running Examples

All examples are in the `samples/` directory.

### Prerequisites

1. **[RabbitMQ](https://www.rabbitmq.com/)** running on `localhost:5672`

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4-management
```

2. **Build packages** (in repository root)

```bash
pnpm build
```

### Run Basic Order Processing

```bash
# Terminal 1: Start the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev

# Terminal 2: Run the client
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

## Example Structure

The basic order processing example uses three packages:

```
samples/
├── basic-order-processing-contract/
│   └── src/index.ts       # Shared contract
├── basic-order-processing-client/
│   └── src/index.ts       # Publisher
└── basic-order-processing-worker/
    └── src/index.ts       # Consumer
```

This separation mirrors real-world microservices architecture.

## Architecture Overview

```mermaid
flowchart TB
    subgraph "Contract"
        Contract["📋 Contract<br/>Exchanges, Queues, Publishers, Consumers"]
    end

    subgraph "Publisher"
        Client["📤 Client App"]
        TypedClient["TypedAmqpClient"]
    end

    subgraph "RabbitMQ"
        Exchange["🔄 Exchange"]
        Queue["📬 Queue"]
    end

    subgraph "Consumer"
        Worker["📥 Worker App"]
        TypedWorker["TypedAmqpWorker"]
    end

    Contract -.->|import| Client
    Contract -.->|import| Worker

    Client -->|publish| TypedClient
    TypedClient -->|Type-safe + Validation| Exchange
    Exchange -->|routing| Queue
    Queue -->|Type-safe + Validation| TypedWorker
    TypedWorker -->|handle| Worker

    style Contract fill:#e1f5ff
    style TypedClient fill:#d4edda
    style TypedWorker fill:#d4edda
    style Exchange fill:#fff3cd
    style Queue fill:#f8d7da
```

## Next Steps

- Try the [Basic Order Processing](/examples/basic-order-processing) example
- Read the [Getting Started](/guide/getting-started) guide
