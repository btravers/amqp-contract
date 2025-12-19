# Client Usage

Learn how to use the type-safe AMQP client to publish messages.

## Installation

Install the required packages:

::: code-group

```bash [pnpm]
pnpm add @amqp-contract/client amqplib
```

```bash [npm]
npm install @amqp-contract/client amqplib
```

```bash [yarn]
yarn add @amqp-contract/client amqplib
```

:::

## Creating a Client

Create a type-safe client from your contract:

```typescript
import { createClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { contract } from './contract';

// Connect to RabbitMQ
const connection = await connect('amqp://localhost');

// Create client from contract
const client = createClient(contract);
await client.connect(connection);
```

## Publishing Messages

The client provides type-safe publishing based on your contract publishers:

```typescript
// TypeScript knows the available publishers and their message schemas
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  customerId: 'CUST-456',
  amount: 99.99,
  items: [
    { productId: 'PROD-A', quantity: 2 },
  ],
});
```

### Type Safety

The client enforces:

- ✅ **Valid publisher names** - Only publishers defined in the contract
- ✅ **Message schema** - Messages must match the Zod schema
- ✅ **Autocomplete** - Full IDE support for publisher names and message fields

```typescript
// ❌ TypeScript error: 'unknownPublisher' not in contract
await client.publish('unknownPublisher', { ... });

// ❌ TypeScript error: missing required field 'orderId'
await client.publish('orderCreated', {
  customerId: 'CUST-456',
});

// ❌ Runtime error: Zod validation fails
await client.publish('orderCreated', {
  orderId: 123, // should be string
  customerId: 'CUST-456',
});
```

## Publishing Options

### Custom Routing Key

Override the routing key for a specific message:

```typescript
await client.publish(
  'orderCreated',
  { orderId: 'ORD-123', amount: 99.99 },
  { routingKey: 'order.created.urgent' }
);
```

### Message Properties

Set AMQP message properties:

```typescript
await client.publish(
  'orderCreated',
  { orderId: 'ORD-123', amount: 99.99 },
  {
    persistent: true,
    priority: 10,
    contentType: 'application/json',
    headers: {
      'x-request-id': 'req-123',
    },
  }
);
```

## Connection Management

### Closing the Connection

```typescript
// Close the client (closes the channel)
await client.close();

// Close the connection
await connection.close();
```

### Error Handling

```typescript
try {
  await client.publish('orderCreated', {
    orderId: 'ORD-123',
    amount: 99.99,
  });
} catch (error) {
  if (error.name === 'ZodError') {
    console.error('Validation failed:', error.issues);
  } else {
    console.error('Publishing failed:', error);
  }
}
```

## Advanced Usage

### Multiple Clients

You can create multiple clients from the same contract:

```typescript
const client1 = createClient(contract);
await client1.connect(connection1);

const client2 = createClient(contract);
await client2.connect(connection2);
```

### Reusing Connections

Share a single connection across clients:

```typescript
const connection = await connect('amqp://localhost');

const orderClient = createClient(orderContract);
await orderClient.connect(connection);

const paymentClient = createClient(paymentContract);
await paymentClient.connect(connection);
```

## Best Practices

1. **Validate Early** - Let Zod catch invalid data before publishing
2. **Handle Errors** - Always wrap publish calls in try-catch
3. **Reuse Connections** - Share connections when possible
4. **Close Cleanly** - Always close clients and connections on shutdown
5. **Use Persistent Messages** - Set `persistent: true` for important messages

## Complete Example

```typescript
import { createClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { contract } from './contract';

async function main() {
  let connection;
  let client;

  try {
    // Connect
    connection = await connect('amqp://localhost');
    client = createClient(contract);
    await client.connect(connection);

    // Publish messages
    await client.publish('orderCreated', {
      orderId: 'ORD-123',
      customerId: 'CUST-456',
      amount: 99.99,
      items: [
        { productId: 'PROD-A', quantity: 2 },
      ],
    });

    console.log('Message published successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup
    await client?.close();
    await connection?.close();
  }
}

main();
```

## Next Steps

- Learn about [Worker Usage](/guide/worker-usage) for consuming messages
- Explore [Defining Contracts](/guide/defining-contracts)
- See [Examples](/examples/) for complete implementations
