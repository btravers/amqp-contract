# @amqp-contract/worker

Type-safe AMQP worker for consuming messages using amqp-contract.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/worker)**

## Installation

```bash
pnpm add @amqp-contract/worker amqplib
```

## Usage

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { connect } from 'amqplib';
import { contract } from './contract';

// Connect to RabbitMQ
const connection = await connect('amqp://localhost');

// Create worker from contract with handlers (automatically connects and starts consuming)
const worker = await TypedAmqpWorker.create({
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

### `TypedAmqpWorker.create(options)`

Create a type-safe AMQP worker from a contract with message handlers. Automatically connects and starts consuming all messages.

**Parameters:**

- `options.contract` - Contract definition
- `options.handlers` - Object with handler functions for each consumer
- `options.connection` - amqplib Connection object

### `TypedAmqpWorker.connect(connection)`

Connect to an AMQP broker and set up all exchanges, queues, and bindings defined in the contract.

**Note:** When using `TypedAmqpWorker.create()`, this is called automatically.

### `TypedAmqpWorker.consume(consumerName)`

Start consuming messages for a specific consumer.

### `TypedAmqpWorker.consumeAll()`

Start consuming messages for all consumers defined in the contract.

**Note:** When using `TypedAmqpWorker.create()`, this is called automatically.

### `TypedAmqpWorker.stopConsuming()`

Stop consuming messages from all consumers.

### `TypedAmqpWorker.close()`

Stop consuming and close the channel and connection.

## License

MIT
