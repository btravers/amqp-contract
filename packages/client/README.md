# @amqp-contract/client

**Type-safe AMQP client for publishing messages using amqp-contract with explicit error handling via `Result` types.**

[![CI](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/btravers/amqp-contract/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@amqp-contract/client.svg?logo=npm)](https://www.npmjs.com/package/@amqp-contract/client)
[![npm downloads](https://img.shields.io/npm/dm/@amqp-contract/client.svg)](https://www.npmjs.com/package/@amqp-contract/client)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

📖 **[Full documentation →](https://btravers.github.io/amqp-contract/api/client)**

## Installation

```bash
pnpm add @amqp-contract/client
```

## Usage

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

// Create client from contract (automatically connects and waits for connection)
const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ['amqp://localhost']
});

// Handle connection errors
if (clientResult.isError()) {
  console.error('Failed to create client:', clientResult.error);
  throw clientResult.error; // or handle appropriately
}

const client = clientResult.get();

// Publish message with explicit error handling
const result = await client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

// Handle errors explicitly - no exceptions thrown
if (result.isError()) {
  console.error('Failed to publish:', result.error);
  // result.error is either TechnicalError or MessageValidationError
  return;
}

console.log('Published successfully');

// Clean up
await client.close();
```

## Error Handling

The client uses `Result` types from [@swan-io/boxed](https://github.com/swan-io/boxed) for explicit error handling. Runtime errors are part of the type signature:

```typescript
publish(): Result<boolean, TechnicalError | MessageValidationError>
```

**Error Types:**

- `TechnicalError` - Runtime failures (channel buffer full, network issues, etc.)
- `MessageValidationError` - Message fails schema validation

**Programming Errors** (client not initialized, invalid publisher name) throw exceptions since they indicate bugs caught by TypeScript at compile-time.

## API

### `TypedAmqpClient.create(options)`

Create a type-safe AMQP client from a contract. Automatically connects to RabbitMQ and waits for the connection to be ready.

**Parameters:**

- `options.contract` - Contract definition
- `options.urls` - Array of AMQP connection URLs (e.g., `['amqp://localhost']`)
- `options.connectionOptions` - Optional connection manager options
- `options.logger` - Optional logger for logging published messages

**Returns:** `Future<Result<TypedAmqpClient, TechnicalError>>`

The method returns a Future that resolves to a Result. You must:

1. Await the Future to get the Result
2. Check if the Result is Ok or Error
3. Extract the client using `.get()` if successful

**Example:**

```typescript
const clientResult = await TypedAmqpClient.create({ contract, urls: ['amqp://localhost'] });
if (clientResult.isError()) {
  throw clientResult.error; // Handle connection error
}
const client = clientResult.get();
```

### `TypedAmqpClient.publish(publisherName, message, options?)`

Publish a message using a defined publisher. The message will be validated against the schema and type-checked at compile time.

**Parameters:**

- `publisherName` - Name of the publisher (type-checked against contract)
- `message` - Message payload (type-checked against publisher schema)
- `options` - Optional publish options (e.g., headers, priority)

**Returns:** `Result<boolean, TechnicalError | MessageValidationError>`

**Example:**

```typescript
const result = client.publish('orderCreated', { orderId: '123' });

if (result.isOk()) {
  // Message published successfully
  console.log('Published:', result.value); // true
} else {
  // Handle specific error types
  if (result.error instanceof MessageValidationError) {
    console.error('Validation failed:', result.error.issues);
  } else if (result.error instanceof TechnicalError) {
    console.error('Technical error:', result.error.message);
  }
}
```

### `TypedAmqpClient.close()`

Close the channel and connection.

**Returns:** `Promise<void>`

## Documentation

📖 **[Read the full documentation →](https://btravers.github.io/amqp-contract)**

## License

MIT
