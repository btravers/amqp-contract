# Basic Order Processing - Worker

Consumer application demonstrating type-safe AMQP message consumption with multiple handlers.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**

## Quick Start

```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 rabbitmq:4-management

# Run the worker
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev
```

## Code Organization

This sample demonstrates two approaches to organizing worker handlers:

### Inline Handlers (src/index.ts - Main Example)

Handlers are defined directly in the worker creation. This approach is suitable for:

- Simple applications with few handlers
- Quick prototypes
- When handlers don't need to be reused

```typescript
const workerResult = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: async (message) => {
      // Handler logic here
    },
    notifyOrder: async (message) => {
      // Handler logic here
    },
  },
  urls: [env.AMQP_URL],
});
```

### External Handlers (src/handlers.ts - Better Organization)

Handlers are defined in separate files using `defineHandler` or `defineHandlers`. This approach is recommended for:

- Production applications
- Better code organization and testability
- Reusable handlers across multiple workers
- Clearer separation of concerns

```typescript
// handlers.ts
export const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    // Handler logic here
  }
);

// index.ts
const workerResult = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
    // ... other handlers
  },
  urls: [env.AMQP_URL],
});
```

The main `src/index.ts` file shows the inline approach for simplicity, while `src/handlers.ts` demonstrates how to organize handlers externally for better maintainability.

## Environment Variables

| Variable    | Default                 | Description                   |
| ----------- | ----------------------- | ----------------------------- |
| `AMQP_URL`  | `amqp://localhost:5672` | RabbitMQ connection URL       |
| `LOG_LEVEL` | `info`                  | Log level (info, debug, etc.) |

For detailed documentation, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
