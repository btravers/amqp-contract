# Installation

## Prerequisites

- Node.js 18 or higher
- RabbitMQ or another AMQP 0.9.1 broker

## Core Packages

Install the essentials:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
pnpm add -D @types/amqplib
```

```bash [npm]
npm install @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
npm install -D @types/amqplib
```

```bash [yarn]
yarn add @amqp-contract/contract @amqp-contract/client @amqp-contract/worker amqplib zod
yarn add -D @types/amqplib
```

:::

## Optional Packages

### AsyncAPI Generation

For generating AsyncAPI 3.0 specifications:

```bash
pnpm add @amqp-contract/asyncapi
```

### NestJS Integration

For NestJS applications:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

```bash [npm]
npm install @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

```bash [yarn]
yarn add @amqp-contract/client-nestjs @amqp-contract/worker-nestjs
```

:::

### Alternative Schema Libraries

Instead of Zod, use Valibot or ArkType:

```bash
# Valibot
pnpm add valibot

# ArkType
pnpm add arktype
```

## RabbitMQ Setup

### Using Docker (Recommended)

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
- For NestJS: See [NestJS Client](/guide/client-nestjs-usage) and [NestJS Worker](/guide/worker-nestjs-usage)
