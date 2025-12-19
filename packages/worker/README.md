# @amqp-contract/worker

Type-safe AMQP worker for consuming messages using amqp-contract.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/worker)**

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

// Create worker from contract with handlers (automatically connects and starts consuming)
const worker = await createWorker({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);
      // Your business logic here
    },
  },
  connection,
});

// Worker is already consuming messages

// Clean up when needed
// await worker.close();
```

## API

### `createWorker(options)`

Create a type-safe AMQP worker from a contract with message handlers. Automatically connects and starts consuming all messages.

**Parameters:**

- `options.contract` - Contract definition
- `options.handlers` - Object with handler functions for each consumer
- `options.connection` - amqplib Connection object

### `AmqpWorker.connect(connection)`

Connect to an AMQP broker and set up all exchanges, queues, and bindings defined in the contract.

**Note:** When using `createWorker()`, this is called automatically.

### `AmqpWorker.consume(consumerName)`

Start consuming messages for a specific consumer.

### `AmqpWorker.consumeAll()`

Start consuming messages for all consumers defined in the contract.

**Note:** When using `createWorker()`, this is called automatically.

### `AmqpWorker.stopConsuming()`

Stop consuming messages from all consumers.

### `AmqpWorker.close()`

Stop consuming and close the channel and connection.

## License

MIT
