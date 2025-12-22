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

## Defining Handlers Outside Worker

You can define handlers outside of the worker creation for better code organization and reusability:

### Single Handler

```typescript
import { defineHandler } from '@amqp-contract/worker';
import { orderContract } from './contract';

// Define handler separately
const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    // message is fully typed based on the contract
    console.log('Processing order:', message.orderId);
    await processPayment(message);
  }
);

// Use in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers: {
    processOrder: processOrderHandler,
  },
  connection: 'amqp://localhost',
});
```

### Multiple Handlers

```typescript
import { defineHandlers } from '@amqp-contract/worker';
import { orderContract } from './contract';

// Define all handlers at once
const handlers = defineHandlers(orderContract, {
  processOrder: async (message) => {
    console.log('Processing order:', message.orderId);
    await processPayment(message);
  },
  notifyOrder: async (message) => {
    await sendNotification(message);
  },
  shipOrder: async (message) => {
    await prepareShipment(message);
  },
});

// Use in worker
const worker = await TypedAmqpWorker.create({
  contract: orderContract,
  handlers,
  connection: 'amqp://localhost',
});
```

### Benefits of External Handler Definitions

- **Better Organization**: Separate handler logic from worker setup
- **Reusability**: Share handlers across multiple workers or tests
- **Type Safety**: Full type checking at definition time
- **Testability**: Test handlers independently before integration

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

### `defineHandler(contract, consumerName, handler)`

Define a type-safe handler for a specific consumer in a contract.

**Parameters:**

- `contract` - The contract definition containing the consumer
- `consumerName` - The name of the consumer from the contract
- `handler` - The async handler function that processes messages

**Returns:** Type-safe handler function

**Example:**

```typescript
const processOrderHandler = defineHandler(
  orderContract,
  'processOrder',
  async (message) => {
    console.log('Processing order:', message.orderId);
  }
);
```

### `defineHandlers(contract, handlers)`

Define multiple type-safe handlers for consumers in a contract at once.

**Parameters:**

- `contract` - The contract definition containing the consumers
- `handlers` - An object with async handler functions for each consumer

**Returns:** Type-safe handlers object

**Example:**

```typescript
const handlers = defineHandlers(orderContract, {
  processOrder: async (message) => {
    await processOrder(message);
  },
  notifyOrder: async (message) => {
    await sendNotification(message);
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
