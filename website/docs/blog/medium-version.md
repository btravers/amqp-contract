# Building Type-Safe AMQP Messaging with amqp-contract

*Bringing end-to-end type safety and automatic validation to RabbitMQ and AMQP messaging in TypeScript*

![amqp-contract logo](https://raw.githubusercontent.com/btravers/amqp-contract/main/website/docs/public/logo.svg)

## The Challenge of Modern Microservices

If you've worked with RabbitMQ or AMQP messaging in TypeScript, you know the pain points:

- **No type safety** at the messaging boundary
- **Manual validation** scattered throughout your codebase
- **Runtime errors** from mismatched data structures
- **Refactoring nightmares** when message schemas change
- **Documentation drift** as code evolves

What if there was a better way?

## Introducing amqp-contract

I'm excited to share [**amqp-contract**](https://github.com/btravers/amqp-contract), an open-source TypeScript library that transforms how you build AMQP messaging systems by bringing:

✅ **End-to-end type safety** — From contract to client and worker
✅ **Automatic validation** — Schema validation with Zod, Valibot, or ArkType  
✅ **Compile-time checks** — TypeScript catches issues before runtime
✅ **AsyncAPI generation** — Automatic documentation
✅ **NestJS integration** — First-class framework support

## From This...

Traditional AMQP code with no type safety:

```typescript
// ❌ No type information, no validation
channel.publish(
  'orders',
  'order.created',
  Buffer.from(JSON.stringify({
    orderId: 'ORD-123',
    amount: 99.99,
    // Did I forget something?
  }))
);

channel.consume('order-processing', (msg) => {
  const data = JSON.parse(msg.content.toString());
  console.log(data.orderId); // No autocomplete!
});
```

## ...To This

Type-safe, validated messaging with amqp-contract:

```typescript
// ✅ Define your contract once
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    totalAmount: z.number().positive(),
    status: z.enum(['pending', 'processing', 'completed']),
  })
);

const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});

// ✅ Type-safe publishing
const client = await TypedAmqpClient.create({ contract, urls: ['amqp://localhost'] });
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  customerId: 'CUST-456',
  totalAmount: 99.99,
  status: 'pending',
  // ✅ Full autocomplete and type checking!
});

// ✅ Type-safe consuming
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // ✅ message is fully typed!
      console.log(message.orderId, message.customerId);
    },
  },
  urls: ['amqp://localhost'],
});
```

## Why It Matters

### For Development Teams

- **Faster Development**: Autocomplete and inline documentation speed up coding
- **Fewer Bugs**: Catch errors at compile-time instead of production
- **Easy Refactoring**: Change a schema, TypeScript shows everywhere to update
- **Better Onboarding**: Clear contracts make the system easier to understand

### For Enterprise Applications

- **Type Safety Across Services**: Share contracts between microservices
- **Automatic Documentation**: Generate AsyncAPI specs from your code
- **Validation at Boundaries**: Ensure data integrity automatically
- **Framework Flexibility**: Use standalone or integrate with NestJS

## Real-World Example: Order Processing

Here's a complete example of an order processing system:

```typescript
import {
  defineContract,
  defineExchange,
  defineQueue,
  definePublisher,
  defineConsumer,
  defineMessage,
  defineQueueBinding,
} from '@amqp-contract/contract';
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { z } from 'zod';

// Define resources
const ordersExchange = defineExchange('orders', 'topic', { durable: true });
const orderProcessingQueue = defineQueue('order-processing', { durable: true });

// Define message schema with validation
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    customerId: z.string(),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().positive(),
      })
    ),
    totalAmount: z.number().positive(),
    status: z.enum(['pending', 'processing', 'completed']),
  })
);

// Build the contract
const contract = defineContract({
  exchanges: { orders: ordersExchange },
  queues: { orderProcessing: orderProcessingQueue },
  bindings: {
    orderBinding: defineQueueBinding(
      orderProcessingQueue,
      ordersExchange,
      { routingKey: 'order.created' }
    ),
  },
  publishers: {
    orderCreated: definePublisher(ordersExchange, orderMessage, {
      routingKey: 'order.created',
    }),
  },
  consumers: {
    processOrder: defineConsumer(orderProcessingQueue, orderMessage),
  },
});

// Publisher service
const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost'],
});

if (clientResult.isOk()) {
  const client = clientResult.get();
  
  const result = await client.publish('orderCreated', {
    orderId: 'ORD-123',
    customerId: 'CUST-456',
    items: [
      { productId: 'PROD-789', quantity: 2, price: 49.99 }
    ],
    totalAmount: 99.98,
    status: 'pending',
  });
  
  result.match({
    Ok: () => console.log('✅ Order published'),
    Error: (error) => console.error('❌ Failed:', error),
  });
}

// Worker service
const workerResult = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log(`Processing order ${message.orderId}`);
      console.log(`Customer: ${message.customerId}`);
      console.log(`Total: $${message.totalAmount}`);
      
      for (const item of message.items) {
        console.log(`- ${item.quantity}x ${item.productId} @ $${item.price}`);
      }
    },
  },
  urls: ['amqp://localhost'],
});
```

## AsyncAPI Generation

Generate AsyncAPI 3.0 specifications automatically:

```typescript
import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';

const generator = new AsyncAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
    description: 'Type-safe AMQP API for order processing',
  },
  servers: {
    production: {
      host: 'rabbitmq.example.com:5672',
      protocol: 'amqp',
      description: 'Production RabbitMQ server',
    },
  },
});

// Use with AsyncAPI Studio, code generators, etc.
```

## NestJS Integration

First-class support for NestJS applications:

```typescript
import { Module } from '@nestjs/common';
import { AmqpWorkerModule } from '@amqp-contract/worker-nestjs';
import { AmqpClientModule } from '@amqp-contract/client-nestjs';

@Module({
  imports: [
    // Worker for consuming messages
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing:', message.orderId);
        },
      },
      connection: process.env.RABBITMQ_URL,
    }),
    // Client for publishing messages
    AmqpClientModule.forRoot({
      contract,
      connection: process.env.RABBITMQ_URL,
    }),
  ],
})
export class AppModule {}
```

The NestJS integration provides:
- Automatic lifecycle management
- Graceful shutdown
- Dependency injection
- Integration with NestJS error handling

## Key Benefits

### Compared to Raw amqplib

| Feature | amqp-contract | Raw amqplib |
|---------|---------------|-------------|
| Type Safety | ✅ Full | ❌ None |
| Validation | ✅ Automatic | ❌ Manual |
| Compile-time Checks | ✅ Yes | ❌ No |
| Refactoring Support | ✅ Full | ❌ Find/Replace |
| Documentation | ✅ From Code | ❌ Manual |

### What Makes It Unique

- **Contract-First**: Define once, use everywhere
- **Standard Schema v1**: Works with Zod, Valibot, ArkType
- **AsyncAPI Support**: Automatic spec generation
- **Result Types**: Explicit error handling, no exceptions
- **Framework Agnostic**: Use standalone or with NestJS

## Getting Started

### Installation

```bash
# Core packages
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker

# Schema library (choose one)
npm install zod  # or valibot, or arktype

# AMQP client
npm install amqplib @types/amqplib
```

### Three Simple Steps

1. **Define your contract** with message schemas
2. **Create a client** for type-safe publishing
3. **Create a worker** for type-safe consuming

That's it! Full type safety from end to end.

## Resources

- 📖 [Full Documentation](https://btravers.github.io/amqp-contract)
- 💻 [GitHub Repository](https://github.com/btravers/amqp-contract)
- 📦 [npm Package](https://www.npmjs.com/package/@amqp-contract/contract)
- 🚀 [Getting Started Guide](https://btravers.github.io/amqp-contract/guide/getting-started)
- 📝 [Examples](https://btravers.github.io/amqp-contract/examples/)

## The Vision

Type safety shouldn't stop at your application boundaries. With **amqp-contract**, you can bring the same level of type safety and developer experience you enjoy with TypeScript to your AMQP messaging layer.

### Our Goals

- Make AMQP messaging as type-safe as REST APIs
- Reduce runtime errors through compile-time checks
- Improve developer productivity with better tooling
- Simplify microservices development
- Generate documentation automatically

## Try It Today

amqp-contract is open source (MIT license) and ready for production use. Whether you're building a new microservices architecture or improving an existing one, give it a try!

```bash
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
```

## Join the Community

We'd love to hear from you:
- 🌟 Star the project on [GitHub](https://github.com/btravers/amqp-contract)
- 🐛 Report issues or request features
- 💡 Share your use cases and feedback
- 🤝 Contribute to the project

## Conclusion

Stop fighting runtime errors. Stop manually validating messages. Stop worrying about refactoring.

**Start building type-safe, validated, and maintainable messaging systems today with amqp-contract.**

---

*Built with inspiration from [tRPC](https://trpc.io/), [oRPC](https://orpc.dev/), and [ts-rest](https://ts-rest.com/) — bringing contract-first development to AMQP messaging.*

**What are your thoughts on type-safe messaging? How do you handle AMQP in your projects? Let's discuss in the comments!**

---

**Useful Links:**
- [Documentation](https://btravers.github.io/amqp-contract)
- [GitHub](https://github.com/btravers/amqp-contract)
- [npm](https://www.npmjs.com/package/@amqp-contract/contract)
- [Getting Started](https://btravers.github.io/amqp-contract/guide/getting-started)

#TypeScript #RabbitMQ #AMQP #Microservices #OpenSource #WebDevelopment #SoftwareEngineering #Backend
