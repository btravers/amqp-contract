# Examples

Explore practical examples of using amqp-contract.

## Available Examples

### [Basic Order Processing](/examples/basic-order-processing)

A complete example demonstrating:
- Contract definition
- Type-safe publishing
- Type-safe consuming
- Multiple consumers (pub/sub pattern)

**Technologies:**
- RabbitMQ
- TypeScript
- Zod schemas

### [AsyncAPI Generation](/examples/asyncapi-generation)

Learn how to generate AsyncAPI 3.0 specifications:
- Generate from contracts
- Server configurations
- Documentation generation

**Technologies:**
- AsyncAPI 3.0
- JSON/YAML output
- Documentation tooling

## Running Examples

All examples are located in the `samples/` directory of the repository.

### Prerequisites

1. RabbitMQ running on `localhost:5672`

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. Build the packages

```bash
pnpm build
```

### Run an Example

```bash
# Terminal 1: Start consumer
pnpm --filter @amqp-contract-samples/basic-order-processing dev:consumer

# Terminal 2: Run publisher
pnpm --filter @amqp-contract-samples/basic-order-processing dev:publisher
```

## Example Structure

Each example follows this structure:

```
samples/example-name/
├── src/
│   ├── contract.ts    # Contract definition
│   ├── publisher.ts   # Message publisher
│   └── consumer.ts    # Message consumer
├── package.json
└── README.md
```

## Next Steps

- Try the [Basic Order Processing](/examples/basic-order-processing) example
- Generate [AsyncAPI specifications](/examples/asyncapi-generation)
- Read the [Getting Started](/guide/getting-started) guide
