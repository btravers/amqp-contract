# @amqp-contract/client

Type-safe AMQP client for publishing messages.

## Installation

```bash
pnpm add @amqp-contract/client
```

## Main Exports

### `TypedAmqpClient.create`

Creates a type-safe AMQP client from a contract and automatically connects to RabbitMQ.

**Signature:**

```typescript
static async create<TContract>(
  options: CreateClientOptions<TContract>
): Promise<TypedAmqpClient<TContract>>
```

**Example:**

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { contract } from './contract';

const client = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://localhost'
});
```

**Parameters:**

- `options` - Configuration object:
  - `contract` - Contract definition created with `defineContract`
  - `connection` - AMQP connection URL (string) or connection options (Options.Connect)

**Returns:** Promise that resolves to a type-safe AMQP client

---

## TypedAmqpClient API

### `connect`

Connects the client to RabbitMQ.

**Note:** When using `TypedAmqpClient.create()`, this method is called automatically. This method is private and not exposed in the public API.

---

### `publish`

Publishes a message with type safety, validation, and explicit error handling.

**Signature:**

```typescript
publish<K extends keyof Publishers>(
  publisher: K,
  message: InferredMessage<Publishers[K]>,
  options?: PublishOptions
): Result<boolean, TechnicalError | MessageValidationError>
```

**Example:**

```typescript
const result = client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});

if (result.isOk()) {
  console.log('Published successfully:', result.value); // true
} else {
  // Handle specific error types
  if (result.error instanceof MessageValidationError) {
    console.error('Validation failed:', result.error.issues);
  } else if (result.error instanceof TechnicalError) {
    console.error('Technical error:', result.error.message);
  }
}
```

**Parameters:**

- `publisher` - Publisher name (from contract)
- `message` - Message object (typed based on schema)
- `options` - Optional publish options
  - `routingKey` - Override the routing key
  - `options` - AMQP publish options:
    - `persistent` - Message persistence (default: `false`)
    - `mandatory` - Return message if not routed (default: `false`)
    - `immediate` - Return message if no consumers (default: `false`)
    - `priority` - Message priority (0-9)
    - `expiration` - Message TTL in milliseconds
    - `contentType` - Content type (default: `'application/json'`)
    - `contentEncoding` - Content encoding
    - `headers` - Custom headers object
    - `correlationId` - Correlation ID
    - `replyTo` - Reply-to queue
    - `messageId` - Message ID
    - `timestamp` - Message timestamp
    - `type` - Message type
    - `userId` - User ID
    - `appId` - Application ID

**Returns:** `Result<boolean, TechnicalError | MessageValidationError>`

- `Result.Ok(true)` - Message published successfully
- `Result.Error(MessageValidationError)` - Message validation failed
- `Result.Error(TechnicalError)` - Runtime error (channel buffer full, etc.)

**Throws:**

Programming errors (bugs) that should be caught at compile-time:
- Client not initialized
- Invalid publisher name (TypeScript prevents this)

---

### `close`

Closes the client channel and connection.

**Signature:**

```typescript
async close(): Promise<void>
```

**Example:**

```typescript
await client.close();
```

---

## Types

### `CreateClientOptions`

```typescript
interface CreateClientOptions<TContract> {
  contract: TContract;
  connection: string | Options.Connect;
}
```

### `PublishOptions`

```typescript
interface PublishOptions {
  routingKey?: string;
  options?: Options.Publish;  // From amqplib
}
```

Where `Options.Publish` includes:
- `persistent?: boolean`
- `mandatory?: boolean`
- `immediate?: boolean`
- `priority?: number`
- `expiration?: string`
- `contentType?: string`
- `contentEncoding?: string`
- `headers?: Record<string, any>`
- `correlationId?: string`
- `replyTo?: string`
- `messageId?: string`
- `timestamp?: number`
- `type?: string`
- `userId?: string`
- `appId?: string`

## Basic Example

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { MessageValidationError, TechnicalError } from '@amqp-contract/client';
import { contract } from './contract';

async function main() {
  // Create client (automatically connects)
  const client = await TypedAmqpClient.create({
    contract,
    connection: 'amqp://localhost'
  });

  // Publish message with explicit error handling
  const result = client.publish('orderCreated', {
    orderId: 'ORD-123',
    customerId: 'CUST-456',
    amount: 99.99,
    items: [
      { productId: 'PROD-A', quantity: 2 },
    ],
    createdAt: new Date().toISOString(),
  });

  if (result.isError()) {
    console.error('Failed to publish:', result.error.message);
    return;
  }

  console.log('Message published!');

  // Cleanup
  await client.close();
}

main();
```

## Publishing with Options

```typescript
// Persistent message
const result1 = client.publish('orderCreated', message, {
  options: {
    persistent: true,
  },
});

// Custom routing key
const result2 = client.publish('orderCreated', message, {
  routingKey: 'order.created.urgent',
});

// With priority and headers
const result3 = client.publish('orderCreated', message, {
  options: {
    persistent: true,
    priority: 10,
    headers: {
      'x-request-id': 'req-123',
      'x-source': 'api',
    },
  },
});

// With expiration (TTL)
const result4 = client.publish('orderCreated', message, {
  options: {
    expiration: '60000', // 60 seconds
  },
});

// Check results
if (result1.isError()) {
  console.error('Failed:', result1.error);
}
```

## Error Handling

```typescript
const result = client.publish('orderCreated', message);

if (result.isError()) {
  // Handle specific error types
  if (result.error instanceof MessageValidationError) {
    // Schema validation error
    console.error('Invalid message:', result.error.issues);
    console.error('Publisher:', result.error.publisherName);
  } else if (result.error instanceof TechnicalError) {
    // Technical error (network, channel issues, etc.)
    console.error('Technical error:', result.error.message);
    if (result.error.cause) {
      console.error('Cause:', result.error.cause);
    }
  }
} else {
  console.log('Published successfully:', result.value);
}
```

## Connection Management

```typescript
// Create connection with options
const client = await TypedAmqpClient.create({
  contract,
  connection: {
    protocol: 'amqp',
    hostname: 'localhost',
    port: 5672,
    username: 'guest',
    password: 'guest',
    heartbeat: 30,
  }
});

// Or use a connection string
const client2 = await TypedAmqpClient.create({
  contract,
  connection: 'amqp://guest:guest@localhost:5672?heartbeat=30'
});

// Use client...
const result = client.publish('orderCreated', message);

// Cleanup - closes both channel and connection
await client.close();
```

## Multiple Clients

You can create multiple clients from the same or different contracts:

```typescript
const orderClient = await TypedAmqpClient.create({
  contract: orderContract,
  connection: 'amqp://localhost',
});

const paymentClient = await TypedAmqpClient.create({
  contract: paymentContract,
  connection: 'amqp://localhost',
});

// Use both clients
const orderResult = orderClient.publish('orderCreated', orderMessage);
const paymentResult = paymentClient.publish('paymentProcessed', paymentMessage);

// Handle results
if (orderResult.isError()) {
  console.error('Order publish failed:', orderResult.error);
}
if (paymentResult.isError()) {
  console.error('Payment publish failed:', paymentResult.error);
}

// Cleanup
await orderClient.close();
await paymentClient.close();
```

## Type Inference

The client provides full type inference for publisher names and message schemas:

```typescript
// TypeScript knows available publishers
const result1 = client.publish('orderCreated', ...);   // ✅ Valid
const result2 = client.publish('unknownPublisher', ...); // ❌ TypeScript error

// TypeScript knows message shape
const result3 = client.publish('orderCreated', {
  orderId: 'ORD-123',    // ✅ Required field
  amount: 99.99,         // ✅ Required field
});

const result4 = client.publish('orderCreated', {
  orderId: 'ORD-123',    // ❌ Missing 'amount'
});

const result5 = client.publish('orderCreated', {
  orderId: 123,          // ❌ Wrong type (should be string)
  amount: 99.99,
});
// result5.isError() === true
// result5.error instanceof MessageValidationError === true
```

## See Also

- [Contract API](/api/contract) - Defining contracts
- [Worker API](/api/worker) - Consuming messages
- [Client Usage Guide](/guide/client-usage)
