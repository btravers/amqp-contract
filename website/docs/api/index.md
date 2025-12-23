# API Overview

The amqp-contract library consists of core packages and framework integrations:

## Core Packages

### [@amqp-contract/contract](/api/contract)

The core package for defining AMQP contracts.

```typescript
import { defineContract, defineExchange, defineQueue } from '@amqp-contract/contract';
```

**Key exports:**

- `defineContract` - Define a complete AMQP contract
- `defineExchange` - Define an exchange
- `defineQueue` - Define a queue
- `defineQueueBinding` - Define a binding
- `definePublisher` - Define a publisher with schema
- `defineConsumer` - Define a consumer with schema

### [@amqp-contract/client](/api/client)

Type-safe client for publishing messages.

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
```

**Key exports:**

- `TypedAmqpClient.create` - Create a type-safe AMQP client
- `TypedAmqpClient` - The client class type

### [@amqp-contract/worker](/api/worker)

Type-safe worker for consuming messages.

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
```

**Key exports:**

- `TypedAmqpWorker.create` - Create a type-safe AMQP worker
- `TypedAmqpWorker` - The worker class type

### [@amqp-contract/asyncapi](/api/asyncapi)

Generate AsyncAPI 3.0 specifications from contracts.

```typescript
import { generateAsyncAPI } from '@amqp-contract/asyncapi';
```

**Key exports:**

- `generateAsyncAPI` - Generate AsyncAPI specification
- Various TypeScript types for AsyncAPI documents

## NestJS Integration

### [@amqp-contract/client-nestjs](/api/client-nestjs)

NestJS integration for the type-safe AMQP client.

```typescript
import { AmqpClientModule, AmqpClientService } from '@amqp-contract/client-nestjs';
```

**Key exports:**

- `AmqpClientModule` - NestJS dynamic module for client
- `AmqpClientService` - Injectable service for publishing messages

**Features:**

- ✅ Automatic lifecycle management
- ✅ Dependency injection
- ✅ forRoot/forRootAsync configuration
- ✅ Graceful shutdown

### [@amqp-contract/worker-nestjs](/api/worker-nestjs)

NestJS integration for the type-safe AMQP worker.

```typescript
import { AmqpWorkerModule, AmqpWorkerService } from '@amqp-contract/worker-nestjs';
```

**Key exports:**

- `AmqpWorkerModule` - NestJS dynamic module for worker
- `AmqpWorkerService` - Injectable service managing the worker

**Features:**

- ✅ Automatic lifecycle management
- ✅ Dependency injection in handlers
- ✅ forRoot/forRootAsync configuration
- ✅ Graceful shutdown

## Type Inference

All packages leverage TypeScript's type inference:

```typescript
import { defineContract, definePublisher } from '@amqp-contract/contract';
import { TypedAmqpClient } from '@amqp-contract/client';
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { z } from 'zod';

// Types are inferred from the contract
const contract = defineContract({
  publishers: {
    orderCreated: definePublisher('orders', z.object({
      orderId: z.string(),
    })),
  },
});

// Connect to RabbitMQ
const connection = await connect('amqp://localhost');

// Client knows about 'orderCreated' and its schema
const client = await TypedAmqpClient.create({ contract, connection });
await client.publish('orderCreated', { orderId: 'ORD-123' });

// Worker handler is fully typed
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      message.orderId; // string
    },
  },
  connection,
});
```

## Common Types

### ContractDefinition

The base type for all contracts:

```typescript
interface ContractDefinition {
  exchanges?: Record<string, ExchangeDefinition>;
  queues?: Record<string, QueueDefinition>;
  bindings?: Record<string, BindingDefinition>;
  publishers?: Record<string, PublisherDefinition>;
  consumers?: Record<string, ConsumerDefinition>;
}
```

### Schema Types

amqp-contract uses Standard Schema, supporting:

- Zod
- Valibot
- ArkType
- Any Standard Schema-compatible library

## Next Steps

### For Framework-Agnostic Usage

- Explore the [@amqp-contract/contract](/api/contract) API
- Learn about the [@amqp-contract/client](/api/client) API
- Understand the [@amqp-contract/worker](/api/worker) API
- Check out [@amqp-contract/asyncapi](/api/asyncapi) generation

### For NestJS Applications

- Get started with [NestJS Client Usage](/guide/client-nestjs-usage)
- Learn about [NestJS Worker Usage](/guide/worker-nestjs-usage)
- Explore [@amqp-contract/client-nestjs](/api/client-nestjs) API
- Understand [@amqp-contract/worker-nestjs](/api/worker-nestjs) API
