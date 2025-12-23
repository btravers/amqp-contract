# @amqp-contract/worker-nestjs

NestJS integration for [@amqp-contract/worker](/api/worker). Type-safe AMQP message consumption with automatic lifecycle management.

## Installation

```bash
pnpm add @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
```

## Overview

The `@amqp-contract/worker-nestjs` package integrates the type-safe AMQP worker with NestJS's module system and lifecycle management. The worker automatically:

- ✅ **Connects** when the NestJS module initializes (`onModuleInit`)
- ✅ **Starts consuming** all messages from queues defined in the contract
- ✅ **Validates** messages using your schema before passing to handlers
- ✅ **Disconnects** gracefully when the application shuts down (`onModuleDestroy`)

## Main Exports

### `AmqpWorkerModule`

A NestJS dynamic module that provides AMQP worker functionality.

**Methods:**

- `forRoot(options)` - Configure the module synchronously
- `forRootAsync(options)` - Configure the module asynchronously (for factories, useClass, useExisting patterns)

---

### `AmqpWorkerService`

A NestJS service that manages the AMQP worker lifecycle. This service is automatically provided when you import `AmqpWorkerModule`.

**Type Parameters:**

- `TContract` - The contract type (automatically inferred)

**Lifecycle:**

- `onModuleInit()` - Automatically creates and starts the worker
- `onModuleDestroy()` - Automatically stops and closes the worker

---

## Basic Usage

### Module Setup

Import and configure the module in your application module:

```typescript
import { Module } from '@nestjs/common';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { contract } from './contract';

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing order:', message.orderId);
          // Your business logic here
        },
        notifyOrder: async (message) => {
          console.log('Sending notification for:', message.orderId);
        },
      },
      connection: 'amqp://localhost',
    }),
  ],
})
export class AppModule {}
```

The worker starts automatically when your NestJS application starts and stops when it shuts down.

---

## Configuration

### `AmqpWorkerModuleOptions`

Configuration options for the worker module.

```typescript
interface AmqpWorkerModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  handlers: WorkerInferConsumerHandlers<TContract>;
  connection: string | Options.Connect;
}
```

**Properties:**

- `contract` - The contract definition created with `defineContract`
- `handlers` - Object mapping consumer names to handler functions
- `connection` - AMQP connection URL (string) or connection options (Options.Connect)

---

## Message Handlers

Each handler receives validated, fully-typed messages based on the contract schema.

### Basic Handler

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => {
      // message is fully typed
      console.log(`Order ID: ${message.orderId}`);
      console.log(`Amount: $${message.amount}`);

      // Your business logic
      await saveOrderToDatabase(message);
    },
  },
  connection: 'amqp://localhost',
})
```

### Handler with Manual Acknowledgment

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message, { ack, nack, reject }) => {
      try {
        await processOrder(message);
        ack(); // Acknowledge success
      } catch (error) {
        console.error('Processing failed:', error);
        nack({ requeue: true }); // Requeue for retry
      }
    },
  },
  connection: 'amqp://localhost',
})
```

**Handler Context Methods:**

- `ack()` - Acknowledge the message (mark as successfully processed)
- `nack(options?)` - Negative acknowledge (reject with optional requeue)
  - `requeue: boolean` - Whether to requeue the message (default: `false`)
- `reject(options?)` - Reject the message
  - `requeue: boolean` - Whether to requeue the message (default: `false`)

---

## Advanced Usage

### Async Configuration

Use `forRootAsync` for dynamic configuration with dependency injection:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { contract } from './contract';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        contract,
        handlers: {
          processOrder: async (message) => {
            console.log('Processing:', message.orderId);
          },
        },
        connection: configService.get('RABBITMQ_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Using Services in Handlers

To use NestJS services in your handlers, you can pass them through the factory:

```typescript
import { Module, Injectable } from '@nestjs/common';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { contract } from './contract';

@Injectable()
export class OrderService {
  async processOrder(orderId: string) {
    // Your business logic
  }
}

@Module({
  imports: [
    AmqpWorkerModule.forRootAsync({
      useFactory: (orderService: OrderService) => ({
        contract,
        handlers: {
          processOrder: async (message) => {
            await orderService.processOrder(message.orderId);
          },
        },
        connection: 'amqp://localhost',
      }),
      inject: [OrderService],
    }),
  ],
  providers: [OrderService],
})
export class AppModule {}
```

### Extracting Handlers to a Service

When you have multiple handlers, it's recommended to extract them into a dedicated service for better organization and testability:

```typescript
// message-handlers.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { WorkerInferConsumerHandlers } from '@amqp-contract/contract';
import type { contract } from './contract';
import { OrderService } from './order.service';
import { NotificationService } from './notification.service';

@Injectable()
export class MessageHandlersService {
  private readonly logger = new Logger(MessageHandlersService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
  ) {}

  getHandlers(): WorkerInferConsumerHandlers<typeof contract> {
    return {
      processOrder: async (message, { ack, nack }) => {
        try {
          this.logger.log(`Processing order ${message.orderId}`);
          await this.orderService.processOrder(message);
          ack();
        } catch (error) {
          this.logger.error(`Failed to process order ${message.orderId}`, error);
          nack({ requeue: true });
        }
      },
      notifyOrder: async (message, { ack, nack }) => {
        try {
          this.logger.log(`Sending notification for ${message.orderId}`);
          await this.notificationService.sendOrderNotification(message);
          ack();
        } catch (error) {
          this.logger.error(`Failed to send notification for ${message.orderId}`, error);
          nack({ requeue: false }); // Don't requeue notification failures
        }
      },
    };
  }
}

// app.module.ts
@Module({
  imports: [
    AmqpWorkerModule.forRootAsync({
      useFactory: (handlersService: MessageHandlersService) => ({
        contract,
        handlers: handlersService.getHandlers(),
        connection: 'amqp://localhost',
      }),
      inject: [MessageHandlersService],
    }),
  ],
  providers: [MessageHandlersService, OrderService, NotificationService],
})
export class AppModule {}
```

This pattern provides:

- **Better organization** - All handlers in one place
- **Easier testing** - Test handlers independently
- **Reusability** - Share handler logic across modules
- **Type safety** - Leverage `WorkerInferConsumerHandlers` for full type inference

### Multiple Workers

You can configure multiple workers in different modules:

```typescript
// order.module.ts
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: orderContract,
      handlers: {
        processOrder: async (message) => {
          // Handle order processing
        },
      },
      connection: 'amqp://localhost',
    }),
  ],
})
export class OrderModule {}

// payment.module.ts
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: paymentContract,
      handlers: {
        processPayment: async (message) => {
          // Handle payment processing
        },
      },
      connection: 'amqp://localhost',
    }),
  ],
})
export class PaymentModule {}
```

---

## Type Safety

The module enforces complete type safety:

### Required Handlers

All consumers defined in the contract must have handlers:

```typescript
// ❌ TypeScript error: missing handler for 'notifyOrder'
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
    // Missing notifyOrder handler!
  },
  connection: 'amqp://localhost',
})

// ✅ All handlers present
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => { ... },
    notifyOrder: async (message) => { ... },
  },
  connection: 'amqp://localhost',
})
```

### Typed Messages

Handler parameters are fully typed based on the contract schemas:

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => {
      // TypeScript knows the exact message shape
      message.orderId;      // string
      message.customerId;   // string
      message.amount;       // number
      message.items;        // array of items

      // Full autocomplete support
      message.items.forEach(item => {
        console.log(`${item.productId}: ${item.quantity}`);
      });
    },
  },
  connection: 'amqp://localhost',
})
```

---

## Error Handling

### Handler Errors

By default, errors in handlers are caught and logged:

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => {
      // If this throws, message is not acknowledged
      await riskyOperation(message);
    },
  },
  connection: 'amqp://localhost',
})
```

### Manual Error Handling

Use acknowledgment functions for better control:

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message, { ack, nack }) => {
      try {
        await processOrder(message);
        ack();
      } catch (error) {
        if (isRetryable(error)) {
          nack({ requeue: true });  // Retry
        } else {
          nack({ requeue: false }); // Send to DLQ
        }
      }
    },
  },
  connection: 'amqp://localhost',
})
```

---

## Best Practices

1. **Use forRootAsync** - For configuration that depends on other modules or services
2. **Service Injection** - Inject services into handlers through the factory pattern
3. **Error Handling** - Always handle errors in handlers and use appropriate acknowledgment
4. **Idempotency** - Ensure handlers can safely retry (messages may be delivered more than once)
5. **Logging** - Log message processing for debugging and monitoring
6. **Dead Letter Queues** - Configure DLQs in your contract for failed messages
7. **Graceful Shutdown** - NestJS handles this automatically via `onModuleDestroy`

---

## Complete Example

```typescript
// contract.ts
import { defineContract, defineExchange, defineQueue, defineQueueBinding, defineConsumer, defineMessage } from '@amqp-contract/contract';
import { z } from 'zod';

const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    })),
  })
);

export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});
```

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
  async saveOrder(order: any) {
    // Save to database
    console.log('Saving order:', order);
  }

  async sendConfirmation(customerId: string) {
    // Send email
    console.log('Sending confirmation to:', customerId);
  }
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { contract } from './contract';
import { OrderService } from './order.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (
        configService: ConfigService,
        orderService: OrderService,
      ) => ({
        contract,
        handlers: {
          processOrder: async (message, { ack, nack }) => {
            try {
              console.log(`Processing order ${message.orderId}`);

              await orderService.saveOrder(message);
              await orderService.sendConfirmation(message.customerId);

              ack();
              console.log(`Order ${message.orderId} processed successfully`);
            } catch (error) {
              console.error('Processing failed:', error);
              nack({ requeue: true });
            }
          },
        },
        connection: configService.get('RABBITMQ_URL') || 'amqp://localhost',
      }),
      inject: [ConfigService, OrderService],
    }),
  ],
  providers: [OrderService],
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(3000);
  console.log('Application is running on: http://localhost:3000');
  console.log('Worker is consuming messages from RabbitMQ');
}

bootstrap();
```

---

## Comparison with @amqp-contract/worker

| Feature            | @amqp-contract/worker | @amqp-contract/worker-nestjs      |
| ------------------ | --------------------- | --------------------------------- |
| **Framework**      | Framework-agnostic    | NestJS-specific                   |
| **Lifecycle**      | Manual connect/close  | Automatic via NestJS lifecycle    |
| **DI Integration** | None                  | Full NestJS dependency injection  |
| **Configuration**  | Direct API calls      | forRoot/forRootAsync pattern      |
| **Shutdown**       | Manual                | Automatic via enableShutdownHooks |

Use `@amqp-contract/worker-nestjs` when:

- ✅ Building a NestJS application
- ✅ Want automatic lifecycle management
- ✅ Need dependency injection in handlers
- ✅ Following NestJS conventions

Use `@amqp-contract/worker` when:

- ✅ Not using NestJS
- ✅ Need more manual control
- ✅ Want framework independence

---

## See Also

- [Worker API](/api/worker) - Core worker functionality
- [Worker Usage Guide](/guide/worker-usage) - General worker usage patterns
- [Contract API](/api/contract) - Defining contracts
- [Client NestJS API](/api/client-nestjs) - NestJS client integration
