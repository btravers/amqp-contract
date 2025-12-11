# Samples

Example implementations demonstrating amqp-contract features.

## Available Samples

### [Basic Order Processing](./basic-order-processing)

Type-safe AMQP messaging for order processing with multiple consumers.

**Features:**
- Type-safe publishers and consumers
- Automatic validation with Zod
- Multiple consumers for pub/sub pattern
- Exchange and queue configuration

## Running Samples

1. Start RabbitMQ:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. Build all packages:

```bash
pnpm build
```

3. Navigate to a sample and follow its README instructions.

## Prerequisites

- Node.js 24+
- pnpm
- RabbitMQ (or other AMQP broker)
