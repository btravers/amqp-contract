# Client Usage

Learn how to use the type-safe AMQP client to publish messages.

::: tip NestJS Users
If you're building a NestJS application, check out the [NestJS Client Usage](/guide/client-nestjs-usage) guide for automatic lifecycle management and dependency injection.
:::

## Installation

Install the required packages:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/client
```

```bash [npm]
npm install @amqp-contract/client
```

```bash [yarn]
yarn add @amqp-contract/client
```

:::

## Creating a Client

Create a type-safe client from your contract. The client automatically connects to RabbitMQ:

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

// Create client from contract (automatically connects)
const client = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://localhost'
});
```

## Publishing Messages

The client provides type-safe publishing with explicit error handling using `Result` types:

```typescript
// TypeScript knows the available publishers and their message schemas
const result = client.publish('orderCreated', {
  orderId: 'ORD-123',
  customerId: 'CUST-456',
  amount: 99.99,
  items: [
    { productId: 'PROD-A', quantity: 2 },
  ],
});

// Handle errors explicitly - no exceptions thrown for runtime errors
if (result.isError()) {
  console.error('Failed to publish:', result.error);
  // result.error is TechnicalError or MessageValidationError
} else {
  console.log('Published successfully');
}
```

### Type Safety

The client enforces:

- ✅ **Valid publisher names** - Only publishers defined in the contract
- ✅ **Message schema** - Messages must match the Zod schema
- ✅ **Autocomplete** - Full IDE support for publisher names and message fields
- ✅ **Explicit error handling** - Runtime errors are returned via `Result` type

```typescript
// ❌ TypeScript error: 'unknownPublisher' not in contract
const result = client.publish('unknownPublisher', { ... });

// ❌ TypeScript error: missing required field 'orderId'
const result = client.publish('orderCreated', {
  customerId: 'CUST-456',
});

// ❌ Runtime validation error returned in Result
const result = client.publish('orderCreated', {
  orderId: 123, // should be string
  customerId: 'CUST-456',
  amount: 99.99,
});
// result.isError() === true
// result.error instanceof MessageValidationError === true
```

## Publishing Options

### Custom Routing Key

Override the routing key for a specific message:

```typescript
const result = client.publish(
  'orderCreated',
  { orderId: 'ORD-123', amount: 99.99 },
  { routingKey: 'order.created.urgent' }
);

if (result.isOk()) {
  console.log('Published with custom routing key');
}
```

### Message Properties

Set AMQP message properties:

```typescript
const result = client.publish(
  'orderCreated',
  { orderId: 'ORD-123', amount: 99.99 },
  {
    options: {
      persistent: true,
      priority: 10,
      contentType: 'application/json',
      headers: {
        'x-request-id': 'req-123',
      },
    },
  }
);

if (result.isError()) {
  console.error('Failed to publish:', result.error.message);
}
```

## Connection Management

### Closing the Connection

```typescript
// Close the client (closes both channel and connection)
await client.close();
```

### Error Handling

The client uses `Result` types from [@swan-io/boxed](https://github.com/swan-io/boxed) for explicit error handling. Runtime errors are returned, not thrown:

```typescript
const result = client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

if (result.isError()) {
  // Handle specific error types
  if (result.error instanceof MessageValidationError) {
    console.error('Validation failed:', result.error.issues);
  } else if (result.error instanceof TechnicalError) {
    console.error('Technical error:', result.error.message);
  }
} else {
  console.log('Published successfully:', result.value);
}
```

**Error Types:**

- `MessageValidationError` - Message fails schema validation
- `TechnicalError` - Runtime failures (channel buffer full, network issues, etc.)

**Note:** Programming errors (client not initialized, invalid publisher name) still throw exceptions since they indicate bugs that should be caught by TypeScript at compile-time.

## Advanced Usage

### Multiple Clients

You can create multiple clients from the same contract:

```typescript
const client1 = await TypedAmqpClient.create({ contract, connection: connection1 });

const client2 = await TypedAmqpClient.create({ contract, connection: connection2 });
```

### Reusing Connections

Share a single connection across clients:

```typescript
const connection = await connect('amqp://localhost');

const orderClient = await TypedAmqpClient.create({
  contract: orderContract,
  connection,
});

const paymentClient = await TypedAmqpClient.create({
  contract: paymentContract,
  connection,
});
```

## Best Practices

1. **Validate Early** - Let Zod catch invalid data before publishing
2. **Handle Errors** - Always wrap publish calls in try-catch
3. **Reuse Clients** - Share clients when possible for the same contract
4. **Close Cleanly** - Always close clients on shutdown (closes both channel and connection)
5. **Use Persistent Messages** - Set `persistent: true` for important messages

## Complete Example

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { MessageValidationError, TechnicalError } from '@amqp-contract/client';
import { contract } from './contract';

async function main() {
  let client;

  try {
    // Connect
    client = await TypedAmqpClient.create({
      contract,
      connection: 'amqp://localhost'
    });

    // Publish messages with explicit error handling
    const result = client.publish('orderCreated', {
      orderId: 'ORD-123',
      customerId: 'CUST-456',
      amount: 99.99,
      items: [
        { productId: 'PROD-A', quantity: 2 },
      ],
    });

    if (result.isError()) {
      if (result.error instanceof MessageValidationError) {
        console.error('Validation failed:', result.error.issues);
      } else if (result.error instanceof TechnicalError) {
        console.error('Technical error:', result.error.message);
      }
      return;
    }

    console.log('Message published successfully');
  } catch (error) {
    // Only programming errors (bugs) throw exceptions
    console.error('Unexpected error:', error);
  } finally {
    // Cleanup - closes both channel and connection
    await client?.close();
  }
}

main();
```

## Next Steps

- Learn about [Worker Usage](/guide/worker-usage) for consuming messages
- Explore [Defining Contracts](/guide/defining-contracts)
- See [Examples](/examples/) for complete implementations
