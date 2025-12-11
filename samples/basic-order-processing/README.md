# Basic Order Processing Sample

This sample demonstrates type-safe AMQP messaging with order processing.

## Prerequisites

- RabbitMQ running on `localhost:5672` (or set `AMQP_URL` environment variable)

You can start RabbitMQ with Docker:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

## Running the Sample

1. Build the packages:

```bash
pnpm build
```

2. Start the consumer (in one terminal):

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing dev:consumer
```

3. Run the publisher (in another terminal):

```bash
pnpm --filter @amqp-contract-samples/basic-order-processing dev:publisher
```

## What It Does

- **Contract**: Defines exchanges, queues, bindings, publishers, and consumers with type-safe schemas
- **Publisher**: Publishes order events with automatic validation
- **Consumer**: Consumes and processes orders with type-safe handlers
- Multiple consumers can subscribe to the same messages (pub/sub pattern)

## Key Features Demonstrated

✅ Type-safe message publishing  
✅ Type-safe message consumption  
✅ Automatic schema validation  
✅ Multiple consumers for the same message  
✅ Exchange and queue configuration  
✅ Routing keys and bindings
