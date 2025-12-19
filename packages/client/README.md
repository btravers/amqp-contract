# @amqp-contract/client

Type-safe AMQP client for publishing messages using amqp-contract.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/client)**

## Installation

```bash
pnpm add @amqp-contract/client amqplib
```

## Usage

```typescript
import { createClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { contract } from './contract';

// Connect to RabbitMQ
const connection = await connect('amqp://localhost');

// Create client from contract
const client = createClient(contract);
await client.connect(connection);

// Publish message with type safety
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

// Clean up
await client.close();
```

## API

### `createClient(contract)`

Create a type-safe AMQP client from a contract.

### `AmqpClient.connect(connection)`

Connect to an AMQP broker and set up all exchanges, queues, and bindings defined in the contract.

### `AmqpClient.publish(publisherName, message, options?)`

Publish a message using a defined publisher. The message will be validated against the schema and type-checked at compile time.

### `AmqpClient.close()`

Close the channel and connection.

## License

MIT
