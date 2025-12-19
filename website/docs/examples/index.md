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
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4-management
```

2. Build the packages

```bash
pnpm build
```

### Run an Example

The basic order processing example is split into three packages:

```bash
# Terminal 1: Start the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev

# Terminal 2: Run the client
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

## Example Structure

The basic order processing example is structured as three separate packages for better separation of concerns:

```
samples/
├── basic-order-processing-contract/
│   ├── src/
│   │   └── index.ts       # Shared contract definition
│   ├── package.json
│   └── README.md
├── basic-order-processing-client/
│   ├── src/
│   │   └── index.ts       # Message publisher
│   ├── package.json
│   └── README.md
└── basic-order-processing-worker/
    ├── src/
    │   └── index.ts       # Message consumer
    ├── package.json
    └── README.md
```

## Next Steps

- Try the [Basic Order Processing](/examples/basic-order-processing) example
- Generate [AsyncAPI specifications](/examples/asyncapi-generation)
- Read the [Getting Started](/guide/getting-started) guide
