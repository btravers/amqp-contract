# NestJS Client Usage

Learn how to integrate the type-safe AMQP client with NestJS applications for publishing messages with automatic lifecycle management.

## Why Use NestJS Integration?

The `@amqp-contract/client-nestjs` package provides seamless integration with NestJS:

- ✅ **Automatic lifecycle management** - Client connects and disconnects with your application
- ✅ **Dependency injection** - Use the client service anywhere in your application
- ✅ **NestJS conventions** - Follows standard module configuration patterns
- ✅ **Graceful shutdown** - Properly handles application shutdown hooks
- ✅ **Type safety** - Full TypeScript support with contract-based types

## Installation

Install the required packages:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

```bash [npm]
npm install @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

```bash [yarn]
yarn add @amqp-contract/client-nestjs @amqp-contract/client @amqp-contract/contract amqplib
```

:::

## Quick Start

### 1. Define Your Contract

First, define your AMQP contract with publishers:

```typescript
// contract.ts
import {
  defineContract,
  defineExchange,
  definePublisher
} from '@amqp-contract/contract';
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

### 2. Configure the Module

Import and configure the client module:

```typescript
// app.module.ts
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

### 3. Use the Client Service

Inject and use the client service in your services or controllers:

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(customerId: string, amount: number, items: any[]) {
    const orderId = this.generateOrderId();

    const result = this.client.publish('orderCreated', {
      orderId,
      customerId,
      amount,
      items,
    });

    if (result.isError()) {
      console.error('Failed to publish order:', result.error);
      throw new Error(`Failed to publish order: ${result.error.message}`);
    }

    console.log(`Order ${orderId} published`);
    return { orderId };
  }

  private generateOrderId(): string {
    return `ORD-${Date.now()}`;
  }
}
```

### 4. Use in Controllers

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

That's it! The client automatically connects when the application starts and disconnects on shutdown.

## Configuration with Environment Variables

Use `@nestjs/config` for environment-based configuration:

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
        connection: configService.get('RABBITMQ_URL') || 'amqp://localhost',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

Then set the environment variable:

```bash
RABBITMQ_URL=amqp://user:pass@rabbitmq-server:5672
```

## Publishing Messages

### Basic Publishing

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(orderId: string, amount: number) {
    const result = this.client.publish('orderCreated', {
      orderId,
      customerId: 'CUST-123',
      amount,
      items: [],
    });

    if (result.isError()) {
      console.error('Failed to publish:', result.error);
      throw new Error(`Publish failed: ${result.error.message}`);
    }

    console.log('Order published successfully');
  }
}
```

### Publishing with Options

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createUrgentOrder(orderId: string, amount: number) {
    const result = this.client.publish(
      'orderCreated',
      {
        orderId,
        customerId: 'CUST-123',
        amount,
        items: [],
      },
      {
        routingKey: 'order.created.urgent',
        options: {
          persistent: true,
          priority: 10,
          headers: {
            'x-priority': 'high',
            'x-source': 'api',
          },
        },
      }
    );

    if (result.isError()) {
      throw new Error(`Failed to publish: ${result.error.message}`);
    }
  }

  async createOrderWithTTL(orderId: string, amount: number) {
    const result = this.client.publish(
      'orderCreated',
      {
        orderId,
        customerId: 'CUST-123',
        amount,
        items: [],
      },
      {
        options: {
          persistent: true,
          expiration: '60000', // 60 seconds
        },
      }
    );

    if (result.isError()) {
      throw new Error(`Failed to publish: ${result.error.message}`);
    }
  }
}
```

## Error Handling

The NestJS client service uses `Result` types for explicit error handling:

### Basic Error Handling

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
    const result = this.client.publish('orderCreated', {
      orderId,
      customerId: 'CUST-123',
      amount,
      items: [],
    });

    if (result.isError()) {
      console.error('Failed to publish order:', result.error);
      throw new Error(`Publish failed: ${result.error.message}`);
    }

    console.log(`Order ${orderId} published successfully`);
    return { orderId };
  }
}
```

### Structured Error Handling

```typescript
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import { MessageValidationError, TechnicalError } from '@amqp-contract/client';
import type { contract } from './contract';

@Injectable()
export class OrderService {
  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(orderId: string, amount: number, items: any[]) {
    const result = this.client.publish('orderCreated', {
      orderId,
      customerId: 'CUST-123',
      amount,
      items,
    });

    if (result.isError()) {
      // Handle specific error types
      if (result.error instanceof MessageValidationError) {
        // Schema validation failed
        throw new BadRequestException({
          message: 'Invalid order data',
          issues: result.error.issues,
        });
      } else if (result.error instanceof TechnicalError) {
        // Runtime/network error
        throw new InternalServerErrorException({
          message: 'Failed to publish order',
          cause: result.error.cause,
        });
      }
    }

    return { orderId };
  }
}
```

## Logging

Use NestJS's built-in logger for structured logging:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(orderId: string, amount: number) {
    this.logger.log(`Publishing order ${orderId}`);

    const result = this.client.publish('orderCreated', {
      orderId,
      customerId: 'CUST-123',
      amount,
      items: [],
    }, {
      options: {
        persistent: true,
        headers: {
          'x-timestamp': new Date().toISOString(),
        },
      },
    });

    if (result.isError()) {
      this.logger.error(
        `Failed to publish order ${orderId}`,
        result.error.message,
      );
      throw result.error;
    }

    this.logger.log(`Order ${orderId} published successfully`);
    return { orderId };
  }
}
```

## Integration Patterns

### oRPC Integration

Use oRPC for type-safe RPC that aligns with amqp-contract's contract-first philosophy:

```typescript
// order.router.ts
import { initServer } from '@orpc/server';
import { z } from 'zod';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

// Helper function to generate unique order IDs
function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Define oRPC router with type-safe schema
export const orderRouter = initServer.router({
  createOrder: initServer
    .input(
      z.object({
        customerId: z.string(),
        amount: z.number().positive(),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
            price: z.number().positive(),
          })
        ),
      })
    )
    .output(
      z.object({
        orderId: z.string(),
        message: z.string(),
      })
    )
    .handler(async ({ input, context }) => {
      const client = context.client as AmqpClientService<typeof contract>;

      const orderId = generateOrderId();

      await client.publish('orderCreated', {
        orderId,
        ...input,
      });

      return {
        orderId,
        message: 'Order submitted for processing',
      };
    }),
});

// order.module.ts
import { Module } from '@nestjs/common';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';
import { contract } from './contract';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract,
      connection: 'amqp://localhost',
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}

// order.controller.ts - Expose oRPC router as NestJS controller
import { Controller, All, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { createServerAdapter } from '@orpc/server/node';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import { orderRouter } from './order.router';
import type { contract } from './contract';

@Controller('orders')
export class OrderController {
  private handler: ReturnType<typeof createServerAdapter>;

  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {
    this.handler = createServerAdapter({
      router: orderRouter,
      context: { client: this.client },
    });
  }

  @All('*')
  async handleRpc(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
```

This pattern provides:

- **End-to-end type safety** from client to server
- **Contract-first design** similar to amqp-contract
- **Automatic validation** with shared schemas
- **Better DX** with full TypeScript inference

### Event Publishing Service

Create a dedicated event publishing service:

```typescript
// order-event.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderEventService {
  private readonly logger = new Logger(OrderEventService.name);

  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async publishOrderCreated(order: any) {
    this.logger.log(`Publishing OrderCreated event for ${order.orderId}`);

    await this.client.publish('orderCreated', order, {
      persistent: true,
      headers: {
        'event-type': 'OrderCreated',
        'event-version': '1.0',
        'aggregate-id': order.orderId,
        'timestamp': new Date().toISOString(),
      },
    });
  }

  async publishOrderUpdated(order: any) {
    this.logger.log(`Publishing OrderUpdated event for ${order.orderId}`);

    await this.client.publish('orderUpdated', order, {
      persistent: true,
      headers: {
        'event-type': 'OrderUpdated',
        'event-version': '1.0',
        'aggregate-id': order.orderId,
        'timestamp': new Date().toISOString(),
      },
    });
  }

  async publishOrderCancelled(orderId: string) {
    this.logger.log(`Publishing OrderCancelled event for ${orderId}`);

    await this.client.publish('orderCancelled', { orderId }, {
      persistent: true,
      headers: {
        'event-type': 'OrderCancelled',
        'event-version': '1.0',
        'aggregate-id': orderId,
        'timestamp': new Date().toISOString(),
      },
    });
  }
}
```

### Multiple Clients

Use multiple clients for different domains:

```typescript
// order.module.ts
@Module({
  imports: [
    AmqpClientModule.forRoot({
      contract: orderContract,
      connection: 'amqp://localhost',
    }),
  ],
  providers: [OrderService, OrderController],
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
  providers: [PaymentService, PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}

// app.module.ts
@Module({
  imports: [OrderModule, PaymentModule],
})
export class AppModule {}
```

## Testing

### Unit Testing with Mocks

```typescript
// order.service.spec.ts
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

    const result = await service.createOrder('CUST-123', 99.99, []);

    expect(result).toHaveProperty('orderId');
    expect(publishSpy).toHaveBeenCalledWith(
      'orderCreated',
      expect.objectContaining({
        orderId: expect.any(String),
        customerId: 'CUST-123',
        amount: 99.99,
        items: [],
      })
    );
  });

  it('should handle publishing errors', async () => {
    jest.spyOn(client, 'publish').mockRejectedValue(new Error('Connection failed'));

    await expect(
      service.createOrder('CUST-123', 99.99, [])
    ).rejects.toThrow('Connection failed');
  });
});
```

### Integration Testing

```typescript
// app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { connect, Connection, Channel } from 'amqplib';
import { AppModule } from '../src/app.module';

describe('Order API (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let channel: Channel;

  beforeAll(async () => {
    connection = await connect('amqp://localhost');
    channel = await connection.createChannel();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await channel.close();
    await connection.close();
    await app.close();
  });

  it('/orders (POST)', async () => {
    // Setup consumer to verify message
    const messages: any[] = [];
    await channel.consume('order-processing', (msg) => {
      if (msg) {
        messages.push(JSON.parse(msg.content.toString()));
        channel.ack(msg);
      }
    });

    // Send HTTP request
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerId: 'CUST-TEST-123',
        amount: 99.99,
        items: [],
      })
      .expect(202);

    expect(response.body).toHaveProperty('orderId');

    // Wait for message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify message was published
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      customerId: 'CUST-TEST-123',
      amount: 99.99,
    });
  });
});
```

## Best Practices

1. **Use forRootAsync** - Always use `forRootAsync` for configuration
2. **Error Handling** - Handle publishing errors appropriately
3. **Persistent Messages** - Use `persistent: true` for important messages
4. **Correlation IDs** - Use `correlationId` to track related messages
5. **Headers** - Add metadata in headers for filtering and debugging
6. **Logging** - Use structured logging with context
7. **Type Safety** - Leverage TypeScript inference for compile-time safety
8. **Testing** - Mock the client service in unit tests
9. **Graceful Shutdown** - Call `app.enableShutdownHooks()` in main.ts
10. **Validation** - Trust contract schemas, but add business validation

## Complete Example

See a full working example:

::: code-group

```typescript [contract.ts]
import {
  defineContract,
  defineExchange,
  definePublisher
} from '@amqp-contract/contract';
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

```typescript [order.service.ts]
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AmqpClientService } from '@amqp-contract/client-nestjs';
import type { contract } from './contract';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly client: AmqpClientService<typeof contract>,
  ) {}

  async createOrder(customerId: string, amount: number, items: any[]) {
    const orderId = this.generateOrderId();

    this.logger.log(`Creating order ${orderId} for customer ${customerId}`);

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
          'x-customer-id': customerId,
        },
      });

      this.logger.log(`Order ${orderId} published successfully`);
      return { orderId };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Failed to publish order ${orderId}`, error.stack);
      } else {
        this.logger.error(`Failed to publish order ${orderId}`);
      }

      // Handle schema validation errors
      if (this.isValidationError(error)) {
        throw new BadRequestException('Invalid order data');
      }
      throw error;
    }
  }

  private isValidationError(error: unknown): error is { issues: unknown } {
    return typeof error === 'object' && error !== null && 'issues' in error;
  }

  private generateOrderId(): string {
    return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
```

```typescript [order.controller.ts]
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
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
  @HttpCode(HttpStatus.ACCEPTED)
  async createOrder(@Body() dto: CreateOrderDto) {
    const result = await this.orderService.createOrder(
      dto.customerId,
      dto.amount,
      dto.items
    );

    return {
      message: 'Order submitted for processing',
      ...result,
    };
  }
}
```

```typescript [app.module.ts]
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

```typescript [main.ts]
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(3000);

  logger.log('Application is running on: http://localhost:3000');
  logger.log('AMQP client connected and ready to publish');
}

bootstrap();
```

:::

## Next Steps

- Learn about [NestJS Worker Usage](/guide/worker-nestjs-usage) for consuming messages
- Explore [Client API](/api/client) for core functionality
- See [Client NestJS API](/api/client-nestjs) for detailed API reference
- Read about [Defining Contracts](/guide/defining-contracts)
