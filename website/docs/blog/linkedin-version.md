# Building Type-Safe AMQP Messaging with amqp-contract

🚀 Excited to share an open-source project I've been working on: **amqp-contract**!

## The Problem

Working with RabbitMQ/AMQP in TypeScript? You've probably dealt with:

❌ No type safety at messaging boundaries
❌ Manual validation everywhere
❌ Runtime errors from mismatched schemas
❌ Refactoring nightmares
❌ Documentation drift

## The Solution

amqp-contract brings contract-first development to AMQP messaging:

✅ End-to-end type safety
✅ Automatic validation (Zod/Valibot/ArkType)
✅ Compile-time checks
✅ AsyncAPI 3.0 generation
✅ First-class NestJS support

## Before & After

**Traditional approach:**

```typescript
// ❌ No types, no validation
channel.publish(
  'orders',
  'order.created',
  Buffer.from(JSON.stringify({
    orderId: 'ORD-123',
    // Missing fields? Wrong types? Who knows!
  }))
);

channel.consume('queue', (msg) => {
  const data = JSON.parse(msg.content.toString()); // unknown
  console.log(data.orderId); // No autocomplete!
});
```

**With amqp-contract:**

```typescript
// ✅ Define contract once
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
  // Full autocomplete and validation!
});

// ✅ Type-safe consuming
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // message is fully typed!
      console.log(message.orderId, message.totalAmount);
    },
  },
  urls: ['amqp://localhost'],
});
```

## Key Features

🔒 **Type Safety**: TypeScript types flow from contract to client and worker
✅ **Auto Validation**: Schema validation at network boundaries
🛠️ **Compile Checks**: Catch errors before runtime
📄 **AsyncAPI**: Generate specs automatically
🎯 **NestJS**: Dedicated integration packages
🔌 **Flexible**: Works with Zod, Valibot, or ArkType

## Why It Matters

For **Development Teams**:
• Faster development with autocomplete
• Fewer production bugs
• Easy refactoring
• Clear contracts for onboarding

For **Enterprise**:
• Type safety across microservices
• Automatic documentation
• Data integrity at boundaries
• Framework flexibility

## Real-World Example

```typescript
// Define message with full validation
const orderMessage = defineMessage(
  z.object({
    orderId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })),
    totalAmount: z.number().positive(),
  })
);

// TypeScript knows exactly what's needed
const result = await client.publish('orderCreated', {
  orderId: 'ORD-123',
  items: [{ productId: 'PROD-1', quantity: 2, price: 29.99 }],
  totalAmount: 59.98,
});

result.match({
  Ok: () => console.log('✅ Published'),
  Error: (error) => console.error('❌ Failed:', error),
});
```

## AsyncAPI Generation

```typescript
import { AsyncAPIGenerator } from '@amqp-contract/asyncapi';

const spec = await generator.generate(contract, {
  info: {
    title: 'Order Processing API',
    version: '1.0.0',
  },
  servers: {
    production: {
      host: 'rabbitmq.example.com:5672',
      protocol: 'amqp',
    },
  },
});
// Use with AsyncAPI tools!
```

## NestJS Integration

```typescript
@Module({
  imports: [
    AmqpWorkerModule.forRoot({
      contract,
      handlers: {
        processOrder: async (message) => {
          console.log('Processing:', message.orderId);
        },
      },
      connection: process.env.RABBITMQ_URL,
    }),
    AmqpClientModule.forRoot({
      contract,
      connection: process.env.RABBITMQ_URL,
    }),
  ],
})
export class AppModule {}
```

## Get Started

```bash
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
npm install zod amqplib @types/amqplib
```

Three simple steps:

1. Define your contract with schemas
2. Create a client for publishing
3. Create a worker for consuming

That's it! Full type safety end-to-end.

## Why amqp-contract?

vs **Raw amqplib**:
• ✅ Type safety vs ❌ No types
• ✅ Auto validation vs ❌ Manual
• ✅ Compile checks vs ❌ Runtime errors
• ✅ Refactoring support vs ❌ Find/replace

vs **Other libraries**:
• Contract-first approach
• Standard Schema v1 support
• AsyncAPI generation
• Result types (no exceptions)
• Framework agnostic

## Resources

📖 Documentation: https://btravers.github.io/amqp-contract
💻 GitHub: https://github.com/btravers/amqp-contract
📦 npm: https://www.npmjs.com/package/@amqp-contract/contract
🚀 Getting Started: https://btravers.github.io/amqp-contract/guide/getting-started

## The Vision

Type safety shouldn't stop at your application boundaries. With amqp-contract, bring the same TypeScript experience to your AMQP messaging layer.

Inspired by tRPC, oRPC, and ts-rest — we're bringing contract-first development to message queues!

## Try It Today

The project is open source (MIT), production-ready, and available now:

```bash
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
```

⭐ Star on GitHub: https://github.com/btravers/amqp-contract

---

**What are your experiences with type-safe messaging? How do you handle AMQP in your TypeScript projects? I'd love to hear your thoughts!**

#TypeScript #RabbitMQ #AMQP #Microservices #OpenSource #WebDev #SoftwareEngineering #Backend #DevOps #NestJS

---

**Links:**
🌐 Website: https://btravers.github.io/amqp-contract
📚 Docs: https://btravers.github.io/amqp-contract/guide/getting-started
💬 GitHub: https://github.com/btravers/amqp-contract
📦 npm: https://www.npmjs.com/package/@amqp-contract/contract
