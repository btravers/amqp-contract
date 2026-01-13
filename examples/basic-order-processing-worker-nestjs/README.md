# Basic Order Processing - NestJS Worker

NestJS worker application demonstrating type-safe AMQP message consumption using dependency injection and modular handlers.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**

## Quick Start

```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 rabbitmq:4-management

# Run the NestJS worker
pnpm --filter @amqp-contract-examples/basic-order-processing-worker-nestjs dev
```

## Features

This sample demonstrates:

- **NestJS Integration**: Using `AmqpWorkerModule` for declarative module configuration
- **Modular Handlers**: Each handler in its own file for better organization
- **Type Safety**: Fully typed message handlers with compile-time validation
- **Automatic Lifecycle**: Connection and consumer management handled by NestJS
- **External Handler Definition**: Using `defineHandler` for reusable handlers

## Code Structure

```
src/
├── handlers/
│   ├── process-order.handler.ts       # Handler for new orders
│   ├── notify-order.handler.ts        # Handler for all order events
│   ├── ship-order.handler.ts          # Handler for shipments
│   ├── handle-urgent-order.handler.ts # Handler for urgent updates
│   ├── process-analytics.handler.ts   # Handler for analytics
│   └── index.ts                       # Handler exports
├── app.module.ts                      # NestJS module configuration
├── main.ts                            # Application bootstrap
└── main.integration.spec.ts           # Integration tests
```

## Key Concepts

### Module Configuration

The `AmqpWorkerModule` is configured in `app.module.ts`:

```typescript
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: orderContract,
      handlers: {
        processOrder: processOrderHandler,
        notifyOrder: notifyOrderHandler,
        shipOrder: shipOrderHandler,
        handleUrgentOrder: handleUrgentOrderHandler,
        processAnalytics: processAnalyticsHandler,
      },
      urls: [env.AMQP_URL],
    }),
  ],
})
export class AppModule {}
```

### Handler Definition

Handlers are defined using `defineHandler` in separate files:

```typescript
// handlers/process-order.handler.ts
import { defineHandler } from "@amqp-contract/worker";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";
import { Logger } from "@nestjs/common";

const logger = new Logger("ProcessOrderHandler");

export const processOrderHandler = defineHandler(
  orderContract,
  "processOrder",
  async ({ payload }) => {
    logger.log(`Processing order: ${payload.orderId}`);
    // Handler logic here
  },
);
```

### Async Configuration

For dynamic configuration (e.g., from ConfigService), use `forRootAsync`:

```typescript
AmqpWorkerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    contract: orderContract,
    handlers: {
      processOrder: processOrderHandler,
      // ... other handlers
    },
    urls: configService.get("AMQP_URLS"),
  }),
  inject: [ConfigService],
});
```

## Handler Organization

This sample demonstrates best practices for handler organization:

1. **One Handler Per File**: Each handler is in its own file for maintainability
2. **Dedicated Logger**: Each handler has its own logger for clear log attribution
3. **Type Safety**: Using `defineHandler` ensures type safety at definition time
4. **Reusability**: Handlers can be imported and used in multiple modules
5. **Testability**: Handlers can be tested independently

## Environment Variables

| Variable   | Default                 | Description             |
| ---------- | ----------------------- | ----------------------- |
| `AMQP_URL` | `amqp://localhost:5672` | RabbitMQ connection URL |

## Message Routing

This worker subscribes to multiple routing patterns:

- `order.created` → `processOrder` handler (new orders)
- `order.#` → `notifyOrder` handler (all order events)
- `order.shipped` → `shipOrder` handler (shipments)
- `order.*.urgent` → `handleUrgentOrder` handler (urgent updates)
- `order.#` (via analytics exchange) → `processAnalytics` handler (analytics)

## Comparison with Plain Worker

| Feature              | Plain Worker              | NestJS Worker            |
| -------------------- | ------------------------- | ------------------------ |
| Module System        | Manual                    | Declarative              |
| Handler Organization | Manual imports            | Automatic                |
| Lifecycle Management | Manual connect/disconnect | Automatic                |
| Configuration        | Direct instantiation      | Module configuration     |
| Testing              | Manual setup              | NestJS testing utilities |

For detailed documentation, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
