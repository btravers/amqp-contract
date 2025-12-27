# Basic Order Processing - NestJS Client

NestJS client application demonstrating type-safe AMQP message publishing using dependency injection.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**

## Quick Start

```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 rabbitmq:4-management

# Run the NestJS client
pnpm --filter @amqp-contract-samples/basic-order-processing-client-nestjs dev
```

## Features

This sample demonstrates:

- **NestJS Integration**: Using `AmqpClientModule` for declarative module configuration
- **Dependency Injection**: Injecting `AmqpClientService` into services
- **Type Safety**: Fully typed message publishing with compile-time validation
- **Service Organization**: Clean separation of concerns with dedicated service classes

## Code Structure

```
src/
├── app.module.ts         # NestJS module configuration
├── order.service.ts      # Business logic with injected AMQP client
├── main.ts              # Application bootstrap
└── main.integration.spec.ts  # Integration tests
```

## Key Concepts

### Module Configuration

The `AmqpClientModule` is configured in `app.module.ts`:

```typescript
@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: orderContract,
      urls: [env.AMQP_URL],
    }),
  ],
  providers: [OrderService],
})
export class AppModule {}
```

### Service with Dependency Injection

Services inject `AmqpClientService` directly:

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly amqpClient: AmqpClientService<typeof orderContract>
  ) {}

  async createOrder(order: Order) {
    const result = await this.amqpClient.publish('orderCreated', {
      ...order,
      createdAt: new Date().toISOString(),
    });

    if (result.isError()) {
      throw result.error;
    }

    return { success: true };
  }
}
```

### Async Configuration

For dynamic configuration (e.g., from ConfigService), use `forRootAsync`:

```typescript
AmqpClientModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    contract: orderContract,
    urls: configService.get('AMQP_URLS'),
  }),
  inject: [ConfigService],
})
```

## Environment Variables

| Variable   | Default                 | Description             |
| ---------- | ----------------------- | ----------------------- |
| `AMQP_URL` | `amqp://localhost:5672` | RabbitMQ connection URL |

## Comparison with Plain Client

| Feature              | Plain Client              | NestJS Client            |
| -------------------- | ------------------------- | ------------------------ |
| Module System        | Manual                    | Declarative              |
| Dependency Injection | Manual                    | Automatic                |
| Lifecycle Management | Manual connect/disconnect | Automatic                |
| Configuration        | Direct instantiation      | Module configuration     |
| Testing              | Manual setup              | NestJS testing utilities |

For detailed documentation, visit the **[website](https://btravers.github.io/amqp-contract/examples/basic-order-processing)**.
