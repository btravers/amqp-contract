# Basic Order Processing - Worker

Consumer application demonstrating type-safe AMQP message consumption with multiple handlers.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**

## Quick Start

```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 rabbitmq:3-management

# Run the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev
```

## Environment Variables

| Variable    | Default                 | Description                     |
| ----------- | ----------------------- | ------------------------------- |
| `AMQP_URL`  | `amqp://localhost:5672` | RabbitMQ connection URL         |
| `LOG_LEVEL` | `info`                  | Log level (info, debug, etc.)   |

For detailed documentation, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
