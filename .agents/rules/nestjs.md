# NestJS Integration

## Module Configuration

Use `AmqpClientModule` for publishing messages and `AmqpWorkerModule` for consuming messages. Both provide automatic lifecycle management — connection is managed automatically (connect on init, disconnect on destroy).

```typescript
import { Module } from "@nestjs/common";
import { AmqpClientModule } from "@amqp-contract/client-nestjs";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { Future, Result } from "@swan-io/boxed";
import { contract } from "./contract";

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract,
      urls: ["amqp://localhost"],
    }),
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: ({ payload }) => {
          console.log("Processing:", payload.orderId);
          return Future.value(Result.Ok(undefined));
        },
      },
      urls: ["amqp://localhost"],
    }),
  ],
})
export class AppModule {}
```

## Dependency Injection

Inject `AmqpClientService<typeof contract>` directly via constructor injection. The client is fully typed and ready to use — methods are inferred from the contract. No manual connection management needed.

```typescript
import { AmqpClientService } from "@amqp-contract/client-nestjs";

@Injectable()
export class OrderService {
  constructor(private readonly amqpClient: AmqpClientService<typeof contract>) {}

  async createOrder(order: Order) {
    await this.amqpClient
      .publish("orderCreated", {
        orderId: order.id,
        amount: order.total,
      })
      .resultToPromise();
  }
}
```

## Connection Sharing

- If using both client and worker, they can share a connection
- For most cases, separate modules with separate connections is simpler

## Error Handling

- Worker errors are logged automatically
- Use try/catch in handlers for custom error handling
- Failed messages can be nacked or sent to dead letter exchanges
