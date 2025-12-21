# @amqp-contract/client-nestjs

NestJS integration for [@amqp-contract/client](/api/client). Type-safe AMQP message publishing with automatic lifecycle management.

## Installation

```bash
pnpm add @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

## Overview

The `@amqp-contract/client-nestjs` package integrates the type-safe AMQP client with NestJS's module system and lifecycle management. The client automatically:

- ✅ **Connects** when the NestJS module initializes (`onModuleInit`)
- ✅ **Validates** messages using your schema before publishing
- ✅ **Provides** type-safe publishing through dependency injection
- ✅ **Disconnects** gracefully when the application shuts down (`onModuleDestroy`)

## Main Exports

### `AmqpClientModule`

A NestJS dynamic module that provides AMQP client functionality.

**Methods:**

- `forRoot(options)` - Configure the module synchronously
- `forRootAsync(options)` - Configure the module asynchronously (for factories, useClass, useExisting patterns)

---

### `AmqpClientService`

A NestJS service that provides type-safe message publishing. This service is automatically provided when you import `AmqpClientModule`.

**Type Parameters:**

- `TContract` - The contract type (automatically inferred)

**Methods:**

- `publish<TName>(publisherName, message, options?)` - Publish a type-safe message

**Lifecycle:**

- `onModuleInit()` - Automatically creates and connects the client
- `onModuleDestroy()` - Automatically closes the client

---

## Basic Usage

### Module Setup

Import and configure the module in your application module:

```typescript
import { Module } from '@nestjs/common';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
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
```

### Publishing Messages

Inject the client service and publish messages:

```typescript
import { Injectable } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(orderId: string, amount: number) {
    await this.client.publish('orderCreated', {
      orderId,
      customerId: 'CUST-123',
      amount,
      items: [],
    });

    console.log(`Order ${orderId} published`);
  }
}
```

---

## Configuration

### `AmqpClientModuleOptions`

Configuration options for the client module.

```typescript
interface AmqpClientModuleOptions<TContract extends ContractDefinition> {
  contract: TContract;
  connection: string | Options.Connect;
}
```

**Properties:**

- `contract` - The contract definition created with `defineContract`
- `connection` - AMQP connection URL (string) or connection options (Options.Connect)

---

## AmqpClientService API

### `publish()`

Publishes a message with type safety and validation.

**Signature:**

```typescript
async publish<TName extends InferPublisherNames<TContract>>(
  publisherName: TName,
  message: ClientInferPublisherInput<TContract, TName>,
  options?: PublishOptions,
): Promise<boolean>
```

**Parameters:**

- `publisherName` - Publisher name from the contract (fully typed)
- `message` - Message object (typed based on the publisher's schema)
- `options` - Optional publish options
  - `routingKey` - Override the routing key
  - `persistent` - Message persistence (default: `false`)
  - `mandatory` - Return message if not routed (default: `false`)
  - `immediate` - Return message if no consumers (default: `false`)
  - `priority` - Message priority (0-9)
  - `expiration` - Message TTL in milliseconds
  - `contentType` - Content type (default: `'application/json'`)
  - `contentEncoding` - Content encoding
  - `headers` - Custom headers object
  - `correlationId` - Correlation ID
  - `replyTo` - Reply-to queue
  - `messageId` - Message ID
  - `timestamp` - Message timestamp
  - `type` - Message type
  - `userId` - User ID
  - `appId` - Application ID

**Returns:** `Promise<boolean>` - Returns `true` when the message is successfully published to the exchange

**Throws:**

- `Error` - If client is not initialized or publishing fails
- Schema validation error (with `issues` property) if message fails validation

**Example:**

```typescript
// Basic publishing
await this.client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

// With options
await this.client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
}, {
  persistent: true,
  priority: 10,
  headers: { 'x-source': 'api' },
});
```

---

## Advanced Usage

### Async Configuration

Use `forRootAsync` for dynamic configuration with dependency injection:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
import { contract } from './contract';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AmqpClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        contract,
        connection: configService.get('RABBITMQ_URL'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Publishing with Custom Options

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createUrgentOrder(orderId: string, amount: number) {
    await this.client.publish(
      'orderCreated',
      { orderId, amount },
      {
        persistent: true,
        priority: 10,
        routingKey: 'order.created.urgent',
        headers: {
          'x-priority': 'high',
          'x-source': 'api',
        },
      }
    );
  }

  async createOrderWithTTL(orderId: string, amount: number) {
    await this.client.publish(
      'orderCreated',
      { orderId, amount },
      {
        persistent: true,
        expiration: '60000', // 60 seconds
      }
    );
  }
}
```

### Multiple Clients

You can configure multiple clients in different modules:

```typescript
// order.module.ts
@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: orderContract,
      connection: 'amqp://localhost',
    }),
  ],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}

// payment.module.ts
@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: paymentContract,
      connection: 'amqp://localhost',
    }),
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
```

---

## Type Safety

The service enforces complete type safety:

### Valid Publisher Names

Only publishers defined in the contract can be used:

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async publishOrder() {
    // ✅ Valid publisher
    await this.client.publish('orderCreated', { ... });

    // ❌ TypeScript error: 'unknownPublisher' not in contract
    await this.client.publish('unknownPublisher', { ... });
  }
}
```

### Typed Messages

Message parameters are fully typed based on the contract schemas:

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder() {
    // ✅ Valid message
    await this.client.publish('orderCreated', {
      orderId: 'ORD-123',
      customerId: 'CUST-456',
      amount: 99.99,
      items: [],
    });

    // ❌ TypeScript error: missing required field 'amount'
    await this.client.publish('orderCreated', {
      orderId: 'ORD-123',
      customerId: 'CUST-456',
    });

    // ❌ TypeScript error: wrong type (amount should be number)
    await this.client.publish('orderCreated', {
      orderId: 'ORD-123',
      customerId: 'CUST-456',
      amount: '99.99',
    });
  }
}
```

---

## Error Handling

### Publishing Errors

Handle errors when publishing:

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(orderId: string, amount: number) {
    try {
      await this.client.publish('orderCreated', {
        orderId,
        customerId: 'CUST-456',
        amount,
        items: [],
      });
      console.log(`Order ${orderId} published successfully`);
    } catch (error) {
      // Handle schema validation errors (works with Zod, Valibot, ArkType)
      // Standard Schema libraries typically expose validation issues
      if (error && typeof error === 'object' && 'issues' in error) {
        console.error('Invalid message:', (error as { issues: unknown }).issues);
      } else {
        // Network or other error
        console.error('Publishing failed:', error);
      }
      throw error;
    }
  }
}
```

### Validation Errors

Schema validation happens before publishing:

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(data: any) {
    try {
      // If data doesn't match schema, throws validation error
      await this.client.publish('orderCreated', data);
    } catch (error) {
      // Handle validation error
      console.error('Validation failed:', error);
      throw new BadRequestException('Invalid order data');
    }
  }
}
```

---

## Integration Patterns

### REST API to AMQP

```typescript
import { Controller, Post, Body, Injectable } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

interface CreateOrderDto {
  customerId: string;
  amount: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const orderId = generateOrderId();

    await this.client.publish('orderCreated', {
      orderId,
      ...dto,
    });

    return { orderId };
  }
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }
}
```

### Event Sourcing

```typescript
import { Injectable } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderEventPublisher {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async publishOrderCreated(order: Order) {
    await this.client.publish('orderCreated', {
      orderId: order.id,
      customerId: order.customerId,
      amount: order.total,
      items: order.items,
    }, {
      persistent: true,
      headers: {
        'event-type': 'OrderCreated',
        'event-version': '1.0',
        'aggregate-id': order.id,
      },
    });
  }

  async publishOrderUpdated(order: Order) {
    await this.client.publish('orderUpdated', {
      orderId: order.id,
      amount: order.total,
    }, {
      persistent: true,
      headers: {
        'event-type': 'OrderUpdated',
        'event-version': '1.0',
        'aggregate-id': order.id,
      },
    });
  }
}
```

---

## Best Practices

1. **Use forRootAsync** - For configuration that depends on other modules or services
2. **Error Handling** - Always handle publishing errors and validation failures
3. **Persistent Messages** - Use `persistent: true` for important messages
4. **Correlation IDs** - Use `correlationId` option to track related messages
5. **Headers** - Add metadata in headers for filtering and routing
6. **Type Safety** - Leverage TypeScript inference for message validation
7. **Graceful Shutdown** - NestJS handles this automatically via `onModuleDestroy`
8. **Testing** - Mock `AmqpClientService` in unit tests

---

## Testing

### Unit Testing with Mocks

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let client: AmqpClientService<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: AmqpClientService,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    client = module.get<AmqpClientService<any>>(AmqpClientService);
  });

  it('should publish order created event', async () => {
    const publishSpy = jest.spyOn(client, 'publish').mockResolvedValue(true);

    await service.createOrder('ORD-123', 99.99);

    expect(publishSpy).toHaveBeenCalledWith('orderCreated', {
      orderId: 'ORD-123',
      customerId: 'CUST-123',
      amount: 99.99,
      items: [],
    });
  });
});
```

---

## Complete Example

```typescript
// contract.ts
import { defineContract, defineExchange, definePublisher } from '@amqp-contract/contract';
import { z } from 'zod';

export const contract = defineContract({
  exchanges: {
    orders: defineExchange('orders', 'topic', { durable: true }),
  },
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
      customerId: z.string(),
      amount: z.number().positive(),
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })),
    }), {
      routingKey: 'order.created',
    }),
  },
});
```

```typescript
// order.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(customerId: string, amount: number, items: any[]) {
    const orderId = this.generateOrderId();

    try {
      await this.client.publish('orderCreated', {
        orderId,
        customerId,
        amount,
        items,
      }, {
        persistent: true,
        headers: {
          'x-source': 'order-service',
          'x-timestamp': new Date().toISOString(),
        },
      });

      console.log(`Order ${orderId} published successfully`);
      return { orderId };
    } catch (error) {
      console.error('Failed to publish order:', error);
      throw new BadRequestException('Failed to create order');
    }
  }

  private generateOrderId(): string {
    return `ORD-${Date.now()}`;
  }
}
```

```typescript
// order.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { OrderService } from './order.service';

interface CreateOrderDto {
  customerId: string;
  amount: number;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
}

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(
      dto.customerId,
      dto.amount,
      dto.items
    );
  }
}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
import { contract } from './contract';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AmqpClientModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        contract,
        connection: configService.get('RABBITMQ_URL') || 'amqp://localhost',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OrderController],
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
}

bootstrap();
```

---

## Comparison with @amqp-contract/client

| Feature            | @amqp-contract/client | @amqp-contract/client-nestjs      |
| ------------------ | --------------------- | --------------------------------- |
| **Framework**      | Framework-agnostic    | NestJS-specific                   |
| **Lifecycle**      | Manual connect/close  | Automatic via NestJS lifecycle    |
| **DI Integration** | None                  | Full NestJS dependency injection  |
| **Configuration**  | Direct API calls      | forRoot/forRootAsync pattern      |
| **Shutdown**       | Manual                | Automatic via enableShutdownHooks |
| **Testing**        | Custom mocks          | NestJS testing utilities          |

Use `@amqp-contract/client-nestjs` when:

- ✅ Building a NestJS application
- ✅ Want automatic lifecycle management
- ✅ Need dependency injection
- ✅ Following NestJS conventions

Use `@amqp-contract/client` when:

- ✅ Not using NestJS
- ✅ Need more manual control
- ✅ Want framework independence

---

## See Also

- [Client API](/api/client) - Core client functionality
- [Client Usage Guide](/guide/client-usage) - General client usage patterns
- [Contract API](/api/contract) - Defining contracts
- [Worker NestJS API](/api/worker-nestjs) - NestJS worker integration
