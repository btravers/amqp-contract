# @amqp-contract/client-nestjs

NestJS integration for [@amqp-contract/client](../client). Type-safe AMQP message publishing with automatic lifecycle management.

## Installation

```bash
pnpm add @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

## Usage

```typescript
import { Injectable, Module } from '@nestjs/common';
import { AmqpClientModule, AmqpClientService } from '@amqp-contract/client-nestjs';
import { contract } from './contract';

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract,
      connection: 'amqp://localhost',
    }),
  ],
})
export class AppModule {}

@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(orderId: string, amount: number) {
    await this.client.publish('orderCreated', { orderId, amount });
  }
}
```

The client automatically connects when the module initializes and cleans up on shutdown.

## License

MIT
