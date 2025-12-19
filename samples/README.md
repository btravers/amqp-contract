# Samples

Example implementations demonstrating amqp-contract features.

## Available Samples

### [Basic Order Processing Contract](./basic-order-processing-contract)

Shared contract definition for the order processing sample.

### [Basic Order Processing Client](./basic-order-processing-client)

Publisher application demonstrating the **RabbitMQ topic pattern**.

**Features:**

- 📦 Type-safe message publishing via contract
- 🎯 Multiple routing key patterns
- ✅ Environment validation with Zod
- 📝 Structured logging with Pino

### [Basic Order Processing Worker](./basic-order-processing-worker)

Consumer application with multiple specialized handlers.

**Features:**

- 📦 Type-safe message consumption via contract
- 🔀 Multiple consumers with wildcard routing (e.g., `order.#`, `order.*.urgent`)
- ✅ Environment validation with Zod
- 📝 Structured logging with Pino

### [AsyncAPI Generation](./asyncapi-generation)

Example of generating AsyncAPI documentation from contracts.

## Running Samples

### Prerequisites

1. Start RabbitMQ:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. Install dependencies and build packages:

```bash
pnpm install
pnpm build
```

### Running Basic Order Processing Example

1. Start the worker (in one terminal):

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-worker dev
```

2. Run the client (in another terminal):

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing-client dev
```

You'll see the worker receiving and processing messages based on the routing keys!

## System Requirements

- Node.js 24.12.0+
- pnpm
- RabbitMQ (or other AMQP broker)
