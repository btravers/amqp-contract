# Order Processing Client

Publisher application that sends order events to RabbitMQ.

## Features

- ✅ Type-safe message publishing via contract
- ✅ Environment validation with Zod
- ✅ Structured logging with Pino
- ✅ Multiple routing key patterns

## Environment Variables

| Variable    | Description                                        | Default                 |
| ----------- | -------------------------------------------------- | ----------------------- |
| `AMQP_URL`  | RabbitMQ connection URL                            | `amqp://localhost:5672` |
| `LOG_LEVEL` | Log level (fatal, error, warn, info, debug, trace) | `info`                  |

## Running

```bash
# Start the client
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev

# With custom environment
AMQP_URL=amqp://rabbitmq:5672 LOG_LEVEL=debug pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

## What It Does

The client publishes 5 different events to demonstrate RabbitMQ's topic pattern:

1. **New Order** (`order.created`) → Routes to: processing + notifications queues
2. **Regular Update** (`order.updated`) → Routes to: notifications queue only
3. **Shipped Order** (`order.shipped`) → Routes to: shipping + notifications queues
4. **Another New Order** (`order.created`) → Routes to: processing + notifications queues
5. **Urgent Update** (`order.updated.urgent`) → Routes to: urgent + notifications queues

## Dependencies

- `@amqp-contract-samples/basic-order-processing-contract` - Shared contract
- `@amqp-contract/client` - Type-safe AMQP client
- `pino` - Structured logging
- `zod` - Schema validation
