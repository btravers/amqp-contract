---
title: NestJS Worker Usage - Type-safe AMQP Message Consuming with NestJS
description: Build type-safe AMQP message consumers in NestJS applications. Learn about automatic lifecycle management, dependency injection, and schema validation with RabbitMQ workers.
---

# NestJS Worker Usage

Learn how to integrate the type-safe AMQP worker with [NestJS](https://nestjs.com/) applications for consuming messages with automatic lifecycle management.

## Why Use NestJS Integration?

The `@amqp-contract/worker-nestjs` package provides seamless integration with [NestJS](https://nestjs.com/):

- ✅ **Automatic lifecycle management** - Worker starts and stops with your application
- ✅ **Dependency injection** - Use NestJS services in your message handlers
- ✅ **NestJS conventions** - Follows standard module configuration patterns
- ✅ **Graceful shutdown** - Properly handles application shutdown hooks
- ✅ **Type safety** - Full TypeScript support with contract-based types

## Installation

Install the required packages:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
```

```bash [npm]
npm install @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
```

```bash [yarn]
yarn add @amqp-contract/worker-nestjs @amqp-contract/worker @amqp-contract/contract amqplib
```

:::

## Quick Start

### 1. Define Your Contract

First, define your AMQP contract with consumers:

```typescript
// contract.ts
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineConsumerFirst,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

// Define resources and messages
const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", { durable: true });

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        price: z.number(),
      }),
    ),
  }),
);

// Consumer-first pattern
const {
  consumer: processOrderConsumer,
  binding: orderBinding,
  createPublisher: createOrderPublisher,
} = defineConsumerFirst(orderProcessingQueue, ordersExchange, orderMessage, {
  routingKey: "order.created",
});

export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: {
    orderBinding: orderBinding,
  },
  consumers: {
    processOrder: processOrderConsumer,
  },
});
```

### 2. Configure the Module

Import and configure the worker module:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { Future, Result } from "@swan-io/boxed";
import { contract } from "./contract";

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: ({ payload }) => {
          console.log(`Processing order: ${payload.orderId}`);
          console.log(`Customer: ${payload.customerId}`);
          console.log(`Amount: $${payload.amount}`);

          // Your business logic here
          return Future.value(Result.Ok(undefined));
        },
      },
      urls: ["amqp://localhost"],
    }),
  ],
})
export class AppModule {}
```

### 3. Start Your Application

```typescript
// main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(3000);
  console.log("Worker is consuming messages");
}

bootstrap();
```

That's it! The worker automatically starts consuming messages when the application starts.

## Using Services in Handlers

To use NestJS services in your handlers, use `forRootAsync` with dependency injection:

```typescript
// order.service.ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class OrderService {
  async saveOrder(payload: { orderId: string }) {
    console.log("Saving order to database:", payload.orderId);
    // Save to database
  }

  async sendConfirmation(customerId: string) {
    console.log("Sending confirmation to:", customerId);
    // Send email
  }
}
```

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { RetryableError } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";
import { contract } from "./contract";
import { OrderService } from "./order.service";

@Module({
  imports: [
    AmqpWorkerModule.forRootAsync({
      useFactory: (orderService: OrderService) => ({
        contract,
        handlers: {
          processOrder: ({ payload }) =>
            Future.fromPromise(
              Promise.all([
                orderService.saveOrder(payload),
                orderService.sendConfirmation(payload.customerId),
              ]),
            )
              .mapOk(() => undefined) // Success - message will be acknowledged automatically
              .mapError((error) => new RetryableError("Order processing failed", error)),
        },
        urls: ["amqp://localhost"],
      }),
      inject: [OrderService],
    }),
  ],
  providers: [OrderService],
})
export class AppModule {}
```

## Configuration with Environment Variables

Use `@nestjs/config` for environment-based configuration:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { RetryableError } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";
import { contract } from "./contract";
import { OrderService } from "./order.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService, orderService: OrderService) => ({
        contract,
        handlers: {
          processOrder: ({ payload }) =>
            Future.fromPromise(orderService.saveOrder(payload))
              .mapOk(() => undefined) // Success - message will be acknowledged automatically
              .mapError((error) => new RetryableError("Order processing failed", error)),
        },
        urls: [configService.get("RABBITMQ_URL") ?? "amqp://localhost"],
      }),
      inject: [ConfigService, OrderService],
    }),
  ],
  providers: [OrderService],
})
export class AppModule {}
```

Then set the environment variable:

```bash
RABBITMQ_URL=amqp://user:pass@rabbitmq-server:5672
```

## Message Acknowledgment

Messages are automatically acknowledged based on handler completion:

- **Success**: Message is acknowledged when handler completes without error
- **Retryable Error**: Throw `RetryableError` to retry the message
- **Non-Retryable Error**: Throw `NonRetryableError` to send to DLQ

```typescript
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";

AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: ({ payload }) => {
      console.log("Processing:", payload.orderId);

      // Success - message is automatically acknowledged
      // For retryable errors, return Result.Error(new RetryableError(...))
      // For permanent failures, return Result.Error(new NonRetryableError(...))
      return Future.value(Result.Ok(undefined));
    },
  },
  urls: ["amqp://localhost"],
});
```

### Error-Based Retry Control

Use typed errors for explicit retry control:

```typescript
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";

AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: ({ payload }) =>
      Future.fromPromise(processOrder(payload))
        .mapOk(() => undefined) // Success - message acknowledged
        .mapError((error) => {
          if (isTemporaryFailure(error)) {
            return new RetryableError("Temporary failure, will retry");
          } else {
            return new NonRetryableError("Permanent failure, send to DLQ");
          }
        }),
  },
  urls: ["amqp://localhost"],
});
```

## Error Handling

### Service-Level Error Handling

Handle errors in your service layer:

```typescript
@Injectable()
export class OrderService {
  async processOrder(order: any) {
    try {
      await this.validateOrder(order);
      await this.saveOrder(order);
      await this.notifyCustomer(order.customerId);
    } catch (error) {
      console.error("Order processing failed:", error);
      throw error; // Let handler decide what to do
    }
  }
}
```

### Handler-Level Error Handling

```typescript
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";

AmqpWorkerModule.forRootAsync({
  useFactory: (orderService: OrderService) => ({
    contract,
    handlers: {
      processOrder: ({ payload }) =>
        Future.fromPromise(orderService.processOrder(payload))
          .mapOk(() => undefined) // Success - message acknowledged automatically
          .mapError((error) => {
            console.error("Handler error:", error);

            if (error instanceof ValidationError) {
              // Don't retry validation errors
              return new NonRetryableError("Validation failed");
            } else if (error instanceof TemporaryError) {
              // Retry temporary errors
              return new RetryableError("Temporary failure");
            } else {
              // Unknown error, don't retry by default
              return new NonRetryableError("Unknown error");
            }
          }),
    },
    urls: ["amqp://localhost"],
  }),
  inject: [OrderService],
});
```

## Structured Logging

Use NestJS's built-in logger:

```typescript
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async processOrder(order: any) {
    this.logger.log(`Processing order ${order.orderId}`);

    try {
      await this.saveOrder(order);
      this.logger.log(`Order ${order.orderId} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process order ${order.orderId}`, error.stack);
      throw error;
    }
  }
}
```

## Multiple Workers

Create separate modules for different domains:

```typescript
import { Future, Result } from "@swan-io/boxed";

// order-worker.module.ts
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: orderContract,
      handlers: {
        processOrder: ({ payload }) => {
          // Handle order processing
          return Future.value(Result.Ok(undefined));
        },
      },
      urls: ["amqp://localhost"],
    }),
  ],
})
export class OrderWorkerModule {}

// payment-worker.module.ts
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: paymentContract,
      handlers: {
        processPayment: ({ payload }) => {
          // Handle payment processing
          return Future.value(Result.Ok(undefined));
        },
      },
      urls: ["amqp://localhost"],
    }),
  ],
})
export class PaymentWorkerModule {}

// app.module.ts
@Module({
  imports: [OrderWorkerModule, PaymentWorkerModule],
})
export class AppModule {}
```

## Testing

### Unit Testing Handlers

Test your handler logic by testing the services they use:

```typescript
// order.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { OrderService } from "./order.service";

describe("OrderService", () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderService],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it("should process order successfully", async () => {
    const order = {
      orderId: "ORD-123",
      customerId: "CUST-456",
      amount: 99.99,
      items: [],
    };

    await expect(service.processOrder(order)).resolves.toBeUndefined();
  });
});
```

### Integration Testing

Test the full worker integration:

```typescript
// app.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { connect, Connection } from "amqplib";
import { AppModule } from "../src/app.module";

describe("AMQP Worker (e2e)", () => {
  let app: INestApplication;
  let connection: Connection;

  beforeAll(async () => {
    connection = await connect("amqp://localhost");

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await connection.close();
  });

  it("should consume and process messages", async () => {
    // Send a test message
    const channel = await connection.createChannel();
    await channel.publish(
      "orders",
      "order.created",
      Buffer.from(
        JSON.stringify({
          orderId: "ORD-TEST-123",
          customerId: "CUST-TEST-456",
          amount: 99.99,
          items: [],
        }),
      ),
    );

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify processing (check database, logs, etc.)
    // ...
  });
});
```

## Best Practices

1. **Use forRootAsync** - Always use `forRootAsync` for dependency injection and configuration
2. **Inject Services** - Inject services into handlers through the factory pattern
3. **Error Handling** - Implement comprehensive error handling with appropriate acknowledgment
4. **Logging** - Use structured logging with context (order IDs, customer IDs, etc.)
5. **Idempotency** - Ensure handlers can safely retry (messages may be delivered more than once)
6. **Validation** - Rely on contract schemas for validation, but add business logic validation
7. **Dead Letter Queues** - Configure DLQs for messages that consistently fail
8. **Monitoring** - Track message processing metrics and errors
9. **Graceful Shutdown** - Always call `app.enableShutdownHooks()` in main.ts
10. **Testing** - Test service logic separately from worker infrastructure

## Complete Example

See a full working example:

::: code-group

```typescript [contract.ts]
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  defineConsumer,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";

const ordersExchange = defineExchange("orders", "topic", { durable: true });
const orderProcessingQueue = defineQueue("order-processing", {
  durable: true,
  arguments: {
    "x-dead-letter-exchange": "orders-dlx",
  },
});

const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number().positive(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      }),
    ),
  }),
);

export const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: {
    orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
      routingKey: "order.created",
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});
```

```typescript [order.service.ts]
import { Injectable, Logger } from "@nestjs/common";

// Define custom error classes for type-safe error handling
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

export class TemporaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemporaryError";
  }
}

interface OrderPayload {
  orderId: string;
  customerId: string;
  amount: number;
  items: Array<{ productId: string; quantity: number; price: number }>;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async processOrder(payload: OrderPayload) {
    this.logger.log(`Processing order ${payload.orderId}`);

    try {
      // Validate business rules
      this.validateOrder(payload);

      // Save to database
      await this.saveToDatabase(payload);

      // Send confirmation
      await this.sendConfirmation(payload.customerId);

      this.logger.log(`Order ${payload.orderId} processed successfully`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to process order ${payload.orderId}`, stack);
      throw error;
    }
  }

  private validateOrder(payload: OrderPayload) {
    if (payload.amount <= 0) {
      throw new BusinessRuleError("Amount must be positive");
    }
    if (payload.items.length === 0) {
      throw new BusinessRuleError("Order must have at least one item");
    }
  }

  private async saveToDatabase(payload: OrderPayload) {
    // Save to database
    this.logger.debug(`Saving order ${payload.orderId} to database`);
  }

  private async sendConfirmation(customerId: string) {
    // Send email
    this.logger.debug(`Sending confirmation to ${customerId}`);
  }
}
```

```typescript [app.module.ts]
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future } from "@swan-io/boxed";
import { contract } from "./contract";
import { OrderService, BusinessRuleError, TemporaryError } from "./order.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    AmqpWorkerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService, orderService: OrderService) => ({
        contract,
        handlers: {
          processOrder: ({ payload }) =>
            Future.fromPromise(orderService.processOrder(payload))
              .mapOk(() => undefined) // Success - message acknowledged automatically
              .mapError((error) => {
                // Use custom error classes with instanceof for type-safe error handling
                // BusinessRuleError and TemporaryError are custom error classes defined in OrderService
                if (error instanceof BusinessRuleError) {
                  // Business rule violation, don't retry
                  return new NonRetryableError("Business rule violation");
                } else if (error instanceof TemporaryError) {
                  // Temporary error, retry
                  return new RetryableError("Temporary error, will retry");
                } else {
                  // Unknown error, don't retry by default
                  return new NonRetryableError("Unknown error");
                }
              }),
        },
        urls: [configService.get("RABBITMQ_URL") ?? "amqp://localhost"],
      }),
      inject: [ConfigService, OrderService],
    }),
  ],
  providers: [OrderService],
})
export class AppModule {}
```

```typescript [main.ts]
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(3000);

  logger.log("Application is running on: http://localhost:3000");
  logger.log("Worker is consuming messages from RabbitMQ");
}

bootstrap();
```

:::

## Next Steps

- Learn about [NestJS Client Usage](/guide/client-nestjs-usage) for publishing messages
- Explore [Worker API](/api/worker/) for core functionality
- See [Worker NestJS API](/api/worker-nestjs/) for detailed API reference
- Read about [Defining Contracts](/guide/defining-contracts)
