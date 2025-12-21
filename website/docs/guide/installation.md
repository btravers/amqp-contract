# Installation

## Prerequisites

- Node.js 18 or higher
- RabbitMQ or another AMQP 0.9.1 broker

## Package Installation

Install the core packages:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
pnpm add amqplib zod
pnpm add -D @types/amqplib
```

```bash [npm]
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
npm install amqplib zod
npm install -D @types/amqplib
```

```bash [yarn]
yarn add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker
yarn add amqplib zod
yarn add -D @types/amqplib
```

:::

## Optional Packages

### AsyncAPI Generation

For generating AsyncAPI specifications:

```bash
pnpm add @amqp-contract/asyncapi
```

### NestJS Integration

For NestJS applications, use the dedicated integration packages:

::: code-group

```bash [pnpm]
# For publishing messages
pnpm add @amqp-contract/client-nestjs

# For consuming messages
pnpm add @amqp-contract/worker-nestjs

# Or install both
pnpm add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

```bash [npm]
npm install @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

```bash [yarn]
yarn add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

:::

These packages include all necessary dependencies and provide automatic lifecycle management for NestJS applications.

### Alternative Schema Libraries

Instead of Zod, you can use other Standard Schema-compatible libraries:

```bash
# Valibot
pnpm add @amqp-contract/valibot valibot

# ArkType
pnpm add @amqp-contract/arktype arktype
```

## RabbitMQ Setup

### Using Docker

The easiest way to get started:

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:4-management
```

Access the management UI at `http://localhost:15672` (guest/guest).

### Manual Installation

Follow the [official RabbitMQ installation guide](https://www.rabbitmq.com/download.html).

## Next Steps

- Follow the [Getting Started](/guide/getting-started) guide
- Learn about [Core Concepts](/guide/core-concepts)
- Explore [Examples](/examples/)
- For NestJS users: Check out [NestJS Client Usage](/guide/client-nestjs-usage) and [NestJS Worker Usage](/guide/worker-nestjs-usage)
