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
import { contract } from "./contract";

@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log(`Processing order: ${message.orderId}`);
          console.log(`Customer: ${message.customerId}`);
          console.log(`Amount: $${message.amount}`);

          // Your business logic here
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
  async saveOrder(order: any) {
    console.log("Saving order to database:", order.orderId);
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
import { contract } from "./contract";
import { OrderService } from "./order.service";

@Module({
  imports: [
    AmqpWorkerModule.forRootAsync({
      useFactory: (orderService: OrderService) => ({
        contract,
        handlers: {
          processOrder: async (message, { ack, nack }) => {
            try {
              await orderService.saveOrder(message);
              await orderService.sendConfirmation(message.customerId);
              ack();
            } catch (error) {
              console.error("Processing failed:", error);
              nack({ requeue: true });
            }
          },
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
          processOrder: async (message, { ack, nack }) => {
            try {
              await orderService.saveOrder(message);
              ack();
            } catch (error) {
              nack({ requeue: true });
            }
          },
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

### Automatic Acknowledgment

By default, messages are automatically acknowledged after successful processing:

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log("Processing:", message.orderId);
      // Message is automatically acked if no error is thrown
    },
  },
  urls: ["amqp://localhost"],
});
```

### Manual Acknowledgment

For better control, use manual acknowledgment:

```typescript
AmqpWorkerModule.forRoot({
  contract,
  handlers: {
    processOrder: async (message, { ack, nack, reject }) => {
      try {
        await processOrder(message);
        ack(); // Acknowledge success
      } catch (error) {
        if (isRetryable(error)) {
          nack({ requeue: true }); // Retry
        } else {
          nack({ requeue: false }); // Send to DLQ
        }
      }
    },
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
AmqpWorkerModule.forRootAsync({
  useFactory: (orderService: OrderService) => ({
    contract,
    handlers: {
      processOrder: async (message, { ack, nack }) => {
        try {
          await orderService.processOrder(message);
          ack();
        } catch (error) {
          console.error("Handler error:", error);

          if (error instanceof ValidationError) {
            // Don't retry validation errors
            nack({ requeue: false });
          } else if (error instanceof TemporaryError) {
            // Retry temporary errors
            nack({ requeue: true });
          } else {
            // Unknown error, don't requeue
            nack({ requeue: false });
          }
        }
      },
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
// order-worker.module.ts
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract: orderContract,
      handlers: {
        processOrder: async (message) => {
          // Handle order processing
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
        processPayment: async (message) => {
          // Handle payment processing
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

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async processOrder(order: any) {
    this.logger.log(`Processing order ${order.orderId}`);

    try {
      // Validate business rules
      this.validateOrder(order);

      // Save to database
      await this.saveToDatabase(order);

      // Send confirmation
      await this.sendConfirmation(order.customerId);

      this.logger.log(`Order ${order.orderId} processed successfully`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to process order ${order.orderId}`, stack);
      throw error;
    }
  }

  private validateOrder(order: any) {
    if (order.amount <= 0) {
      throw new BusinessRuleError("Amount must be positive");
    }
    if (order.items.length === 0) {
      throw new BusinessRuleError("Order must have at least one item");
    }
  }

  private async saveToDatabase(order: any) {
    // Save to database
    this.logger.debug(`Saving order ${order.orderId} to database`);
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
          processOrder: async (message, { ack, nack }) => {
            try {
              await orderService.processOrder(message);
              ack();
            } catch (error) {
              // Use custom error classes with instanceof for type-safe error handling
              // BusinessRuleError and TemporaryError are custom error classes defined in OrderService
              if (error instanceof BusinessRuleError) {
                // Business rule violation, don't retry
                nack({ requeue: false });
              } else if (error instanceof TemporaryError) {
                // Temporary error, retry
                nack({ requeue: true });
              } else {
                // Unknown error, don't retry by default
                nack({ requeue: false });
              }
            }
          },
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
