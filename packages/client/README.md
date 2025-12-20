# @amqp-contract/client

Type-safe AMQP client for publishing messages using amqp-contract.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/client)**

## Installation

```bash
pnpm add @amqp-contract/client
```

## Usage

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

// Create client from contract (automatically connects)
const client = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://localhost'
});

// Publish message with type safety
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

// Clean up
await client.close();
```

## API

### `TypedAmqpClient.create(options)`

Create a type-safe AMQP client from a contract. Automatically connects to RabbitMQ.

**Parameters:**

- `options.contract` - Contract definition
- `options.connection` - AMQP connection URL (string) or connection options (Options.Connect)

### `TypedAmqpClient.publish(publisherName, message, options?)`

Publish a message using a defined publisher. The message will be validated against the schema and type-checked at compile time.

### `TypedAmqpClient.close()`

Close the channel and connection.

## License

MIT
