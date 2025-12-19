# Order Processing Worker

Consumer application that processes order events from RabbitMQ.

## Features

- ✅ Type-safe message consumption via contract
- ✅ Environment validation with Zod
- ✅ Structured logging with Pino
- ✅ Multiple specialized handlers

## Environment Variables

| Variable    | Description                                        | Default                 |
| ----------- | -------------------------------------------------- | ----------------------- |
| `AMQP_URL`  | RabbitMQ connection URL                            | `amqp://localhost:5672` |
| `LOG_LEVEL` | Log level (fatal, error, warn, info, debug, trace) | `info`                  |

## Running

```bash
# Start the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev

# With custom environment
AMQP_URL=amqp://rabbitmq:5672 LOG_LEVEL=debug pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev
```

## Handlers

The worker defines 4 different handlers, each subscribed to different routing key patterns:

### 1. Processing Handler (`processOrder`)

- **Subscribes to**: `order.created`
- **Purpose**: Process new orders
- **Receives**: Full order objects with items and prices

### 2. Notifications Handler (`notifyOrder`)

- **Subscribes to**: `order.#` (ALL events)
- **Purpose**: Send notifications for any order event
- **Receives**: Both full orders and status updates

### 3. Shipping Handler (`shipOrder`)

- **Subscribes to**: `order.shipped`
- **Purpose**: Prepare shipping labels
- **Receives**: Only shipped order status updates

### 4. Urgent Handler (`handleUrgentOrder`)

- **Subscribes to**: `order.*.urgent` (ANY urgent event)
- **Purpose**: Handle urgent updates with priority
- **Receives**: Urgent status updates

## Topic Pattern

| Event Published        | Handlers Triggered              |
| ---------------------- | ------------------------------- |
| `order.created`        | processOrder + notifyOrder      |
| `order.updated`        | notifyOrder only                |
| `order.shipped`        | shipOrder + notifyOrder         |
| `order.updated.urgent` | handleUrgentOrder + notifyOrder |

## Dependencies

- `@amqp-contract-samples/basic-order-processing-contract` - Shared contract
- `@amqp-contract/worker` - Type-safe AMQP worker
- `pino` - Structured logging
- `zod` - Schema validation
