# @amqp-contract/worker

Type-safe AMQP worker for consuming messages using amqp-contract with standard async/await error handling.

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/worker)**

## Installation

```bash
pnpm add @amqp-contract/worker
```

## Usage

```typescript
import { TypedAmqpWorker } from '@amqp-contract/worker';
import { contract } from './contract';

// Create worker from contract with handlers (automatically connects and starts consuming)
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      console.log('Processing order:', message.orderId);

      // Your business logic here
      await processPayment(message);
      await updateInventory(message);

      // If an exception is thrown, the message is automatically requeued
    },
  },
  connection: 'amqp://localhost',
});

// Worker is already consuming messages

// Clean up when needed
// await worker.close();
```

## Error Handling

Worker handlers use standard Promise-based async/await pattern:

```typescript
handlers: {
  processOrder: async (message) => {
    // Standard async/await - no Result wrapping needed
    try {
      await process(message);
      // Message acknowledged automatically on success
    } catch (error) {
      // Exception automatically caught by worker
      // Message is requeued for retry
      throw error;
    }
  }
}
```

**Error Types:**

Worker defines error classes for internal use:

- `TechnicalError` - Runtime failures (parsing, processing)
- `MessageValidationError` - Message fails schema validation

These errors are logged but **handlers don't need to use them** - just throw standard exceptions.

## API

### `TypedAmqpWorker.create(options)`

Create a type-safe AMQP worker from a contract with message handlers. Automatically connects and starts consuming all messages.

**Parameters:**

- `options.contract` - Contract definition
- `options.handlers` - Object with async handler functions for each consumer
- `options.connection` - AMQP connection URL (string) or connection options (Options.Connect)

**Returns:** `Promise<TypedAmqpWorker>`

**Example:**

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    // Each handler receives type-checked message
    processOrder: async (message) => {
      // message.orderId is type-checked
      console.log(message.orderId);
    },
    processPayment: async (message) => {
      // Different message type for this consumer
      await handlePayment(message);
    },
  },
  connection: {
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
  },
});
```

### Handler Signature

```typescript
type Handler<T> = (message: T) => Promise<void>
```

Handlers are simple async functions that:

- Receive type-checked message as parameter
- Return `Promise<void>`
- Can throw exceptions (message will be requeued)
- Message is acknowledged automatically on success

### `TypedAmqpWorker.close()`

Stop consuming and close the channel and connection.

**Returns:** `Promise<void>`

## License

MIT
