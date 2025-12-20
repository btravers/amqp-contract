# @amqp-contract/worker-nestjs

NestJS integration for [@amqp-contract/worker](../worker). This package provides a type-safe way to consume AMQP messages in NestJS applications without relying on NestJS decorators (except for dependency injection).

## Features

- ✅ Type-safe message consumption
- ✅ Automatic NestJS lifecycle management
- ✅ No decorator-based patterns (except for DI)
- ✅ Full integration with @amqp-contract/worker
- ✅ Built-in validation using Standard Schema v1

## Installation

```bash
pnpm add @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
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
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { defineContract, defineQueue, defineConsumer } from '@amqp-contract/contract';
import { z } from 'zod';
import * as amqp from 'amqplib';

// Define your contract
const myContract = defineContract({
  queues: {
    orders: defineQueue('orders', { durable: true }),
  },
  consumers: {
    processOrder: defineConsumer('orders', z.object({
      orderId: z.string(),
      amount: z.number(),
    })),
  },
});

// Create AMQP connection
const connection = await amqp.connect('amqp://localhost');

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: myContract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing order:', message.orderId, message.amount);
          // Your business logic here
        },
      },
      connection,
    }),
  ],
})
export class AppModule {}
```

### Using the Worker Service

You can inject the `AmqpWorkerService` to access the underlying worker:

```typescript
import { Injectable } from '@nestjs/common';
import { AmqpWorkerService } from '@amqp-contract/worker-nestjs';

@Injectable()
export class MyService {
  constructor(
    private readonly workerService: AmqpWorkerService<typeof myContract>,
  ) {}

  getWorkerStatus() {
    const worker = this.workerService.getWorker();
    return worker ? 'running' : 'stopped';
  }
}
```

## API

### `AmqpWorkerModule`

#### `forRoot<TContract>(options: CreateAmqpWorkerModuleOptions<TContract>): DynamicModule`

Creates a dynamic NestJS module for AMQP worker.

**Options:**

- `contract`: The AMQP contract definition
- `handlers`: Type-safe consumer handlers matching the contract
- `connection`: amqplib connection instance

### `AmqpWorkerService<TContract>`

Service that manages the AMQP worker lifecycle.

**Methods:**

- `getWorker(): TypedAmqpWorker<TContract> | null` - Get the underlying worker instance

**Lifecycle:**

- `onModuleInit()` - Automatically called by NestJS to initialize the worker
- `onModuleDestroy()` - Automatically called by NestJS to close the worker

## Type Safety

This package provides full type safety through TypeScript:

```typescript
// ✅ Type-safe handler - TypeScript will enforce correct message shape
handlers: {
  processOrder: async (message) => {
    // message is typed as { orderId: string; amount: number }
    console.log(message.orderId); // ✅ OK
    console.log(message.invalid); // ❌ TypeScript error
  },
}
```

## Design Philosophy

Unlike many NestJS integrations, this package **does NOT use decorators** for defining consumers or message handlers. This approach ensures:

1. **Type Safety**: Full TypeScript inference without decorator limitations
2. **Simplicity**: Clear, explicit configuration
3. **Testability**: Easy to test without NestJS infrastructure
4. **Flexibility**: Works with any AMQP setup

Decorators are only used for dependency injection (`@Injectable`), which is the NestJS standard.

## License

MIT
