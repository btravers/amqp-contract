# @amqp-contract/client-nestjs

NestJS integration for [@amqp-contract/client](../client). This package provides a type-safe way to publish AMQP messages in NestJS applications without relying on NestJS decorators (except for dependency injection).

## Features

- ✅ Type-safe message publishing
- ✅ Automatic NestJS lifecycle management
- ✅ No decorator-based patterns (except for DI)
- ✅ Full integration with @amqp-contract/client
- ✅ Built-in validation using Standard Schema v1

## Installation

```bash
pnpm add @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

## Peer Dependencies

This package requires the following peer dependencies:

- `@nestjs/common` >= 10.0.0
- `@nestjs/core` >= 10.0.0
- `amqplib` >= 0.10.0
- `reflect-metadata` >= 0.1.13
- `rxjs` >= 7.0.0

## Usage

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
import { defineContract, defineExchange, definePublisher } from '@amqp-contract/contract';
import { z } from 'zod';
import * as amqp from 'amqplib';

// Define your contract
const myContract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher(
      'orders',
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
      { routingKey: 'order.created' }
    ),
  },
});

// Create AMQP connection
const connection = await amqp.connect('amqp://localhost');

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: myContract,
      connection,
    }),
  ],
})
export class AppModule {}
```

### Publishing Messages

Inject the `AmqpClientService` to publish messages:

```typescript
import { Injectable } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';

@Injectable()
export class OrderService {
  constructor(
    private readonly clientService: AmqpClientService<typeof myContract>,
  ) {}

  async createOrder(orderId: string, amount: number) {
    // Type-safe publishing
    await this.clientService.publish('orderCreated', {
      orderId,
      amount,
    });
  }
}
```

### Custom Publishing Options

You can pass custom routing keys and publish options:

```typescript
await this.clientService.publish(
  'orderCreated',
  { orderId: '123', amount: 100 },
  {
    routingKey: 'order.created.premium',
    options: {
      persistent: true,
      priority: 10,
    },
  }
);
```

### Accessing the Underlying Client

```typescript
const client = this.clientService.getClient();
if (client) {
  // Access TypedAmqpClient methods directly
}
```

## API

### `AmqpClientModule`

#### `forRoot<TContract>(options: CreateAmqpClientModuleOptions<TContract>): DynamicModule`

Creates a dynamic NestJS module for AMQP client.

**Options:**

- `contract`: The AMQP contract definition
- `connection`: amqplib connection instance

### `AmqpClientService<TContract>`

Service that manages the AMQP client lifecycle and provides publishing methods.

**Methods:**

- `publish<TName>(publisherName: TName, message: Message, options?: PublishOptions): Promise<boolean>` - Publish a message
- `getClient(): TypedAmqpClient<TContract> | null` - Get the underlying client instance

**Lifecycle:**

- `onModuleInit()` - Automatically called by NestJS to initialize the client
- `onModuleDestroy()` - Automatically called by NestJS to close the client

## Type Safety

This package provides full type safety through TypeScript:

```typescript
// ✅ Type-safe publishing - TypeScript enforces correct message shape
await clientService.publish('orderCreated', {
  orderId: '123',
  amount: 100,
}); // ✅ OK

await clientService.publish('orderCreated', {
  orderId: '123',
  // amount missing
}); // ❌ TypeScript error

await clientService.publish('orderCreated', {
  orderId: '123',
  amount: 'invalid', // wrong type
}); // ❌ TypeScript error

await clientService.publish('invalidPublisher', { ... }); // ❌ TypeScript error
```

## Design Philosophy

Unlike many NestJS integrations, this package **does NOT use decorators** for defining publishers or message schemas. This approach ensures:

1. **Type Safety**: Full TypeScript inference without decorator limitations
2. **Simplicity**: Clear, explicit configuration
3. **Testability**: Easy to test without NestJS infrastructure
4. **Flexibility**: Works with any AMQP setup

Decorators are only used for dependency injection (`@Injectable`), which is the NestJS standard.

## License

MIT
