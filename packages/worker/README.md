# @amqp-contract/worker

Type-safe AMQP worker for consuming messages using amqp-contract.

## Installation

```bash
pnpm add @amqp-contract/worker amqplib
```

## Usage

```typescript
import { createWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

// Connect to RabbitMQ
const connection = await connect('amqp://localhost');

// Create worker from contract with handlers
const worker = createWorker(contract, {
  processOrder: async (message) => {
    console.log('Processing order:', message.orderId);
    // Your business logic here
  },
});

await worker.connect(connection);

// Start consuming all consumers
await worker.consumeAll();

// Or start consuming a specific consumer
// await worker.consume('processOrder');

// Stop consuming when needed
// await worker.stopConsuming();

// Clean up
// await worker.close();
```

## API

### `createWorker(contract, handlers)`

Create a type-safe AMQP worker from a contract with message handlers.

### `AmqpWorker.connect(connection)`

Connect to an AMQP broker and set up all exchanges, queues, and bindings defined in the contract.

### `AmqpWorker.consume(consumerName)`

Start consuming messages for a specific consumer.

### `AmqpWorker.consumeAll()`

Start consuming messages for all consumers defined in the contract.

### `AmqpWorker.stopConsuming()`

Stop consuming messages from all consumers.

### `AmqpWorker.close()`

Stop consuming and close the channel and connection.

## License

MIT
