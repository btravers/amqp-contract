# Samples

Example implementations demonstrating amqp-contract features.

📖 **[Full documentation and examples →](https://btravers.github.io/amqp-contract/examples/)**

## Quick Start

### Prerequisites

Start RabbitMQ:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:4-management
```

### Running Examples

1. Build packages:

```bash
pnpm install
pnpm build
```

2. Run the basic order processing example:

**Plain TypeScript:**

```bash
# Terminal 1: Start the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev

# Terminal 2: Run the client
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

**NestJS:**

```bash
# Terminal 1: Start the NestJS worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker-nestjs dev

# Terminal 2: Run the NestJS client
pnpm --filter @amqp-contract-samples/basic-order-processing-client-nestjs dev
```

## Available Samples

| Sample                                                                             | Description                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Basic Order Processing - Contract](./basic-order-processing-contract)             | Shared contract definition for order processing |
| [Basic Order Processing - Client](./basic-order-processing-client)                 | Plain TypeScript client for publishing orders   |
| [Basic Order Processing - Worker](./basic-order-processing-worker)                 | Plain TypeScript worker for consuming orders    |
| [Basic Order Processing - Client (NestJS)](./basic-order-processing-client-nestjs) | NestJS client with dependency injection         |
| [Basic Order Processing - Worker (NestJS)](./basic-order-processing-worker-nestjs) | NestJS worker with modular handlers             |

For detailed documentation, examples, and tutorials, visit the **[amqp-contract website](https://btravers.github.io/amqp-contract/)**.
