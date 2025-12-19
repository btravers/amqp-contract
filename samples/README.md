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

```bash
# Terminal 1: Start the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev

# Terminal 2: Run the client
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

## Available Samples

| Sample | Description |
|--------|-------------|
| [Basic Order Processing](./basic-order-processing-contract) | Complete example with client, worker, and contract |
| [AsyncAPI Generation](./asyncapi-generation) | Generate AsyncAPI 3.0 specifications |

For detailed documentation, examples, and tutorials, visit the **[amqp-contract website](https://btravers.github.io/amqp-contract/)**.
