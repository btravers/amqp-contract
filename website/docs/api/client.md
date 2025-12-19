# @amqp-contract/client

Type-safe AMQP client for publishing messages.

## Installation

```bash
pnpm add @amqp-contract/client amqplib
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
import { connect } from 'amqplib';
import { contract } from './contract';

const connection = await connect('amqp://localhost');
const client = await TypedAmqpClient.create({ contract, connection });
```

**Parameters:**

- `options` - Configuration object:
  - `contract` - Contract definition created with `defineContract`
  - `connection` - amqplib Connection object

**Returns:** Promise that resolves to a type-safe AMQP client

---

## TypedAmqpClient API

### `connect`

Connects the client to RabbitMQ.

**Note:** When using `TypedAmqpClient.create()`, this method is called automatically. You only need to call this manually if you create a `TypedAmqpClient` instance directly using `new TypedAmqpClient()`.

**Signature:**

```typescript
async connect(connection: Connection): Promise<void>
```

**Example:**

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { connect } from 'amqplib';

const connection = await connect('amqp://localhost');
const client = new TypedAmqpClient(contract);
await client.connect(connection);
```

**Parameters:**

- `connection` - amqplib Connection object

---

### `publish`

Publishes a message with type safety and validation.

**Signature:**

```typescript
async publish<K extends keyof Publishers>(
  publisher: K,
  message: InferredMessage<Publishers[K]>,
  options?: PublishOptions
): Promise<void>
```

**Example:**

```typescript
await client.publish('orderCreated', {
  orderId: 'ORD-123',
  amount: 99.99,
});
```

**Parameters:**

- `publisher` - Publisher name (from contract)
- `message` - Message object (typed based on schema)
- `options` - Optional publish options
  - `routingKey` - Override the routing key
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

**Throws:**

- `ZodError` (or equivalent) if message fails schema validation
- `Error` if publishing fails

---

### `close`

Closes the client channel.

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
  connection: ChannelModel;
}
```

### `PublishOptions`

```typescript
interface PublishOptions {
  routingKey?: string;
  persistent?: boolean;
  mandatory?: boolean;
  immediate?: boolean;
  priority?: number;
  expiration?: string;
  contentType?: string;
  contentEncoding?: string;
  headers?: Record<string, any>;
  correlationId?: string;
  replyTo?: string;
  messageId?: string;
  timestamp?: number;
  type?: string;
  userId?: string;
  appId?: string;
}
```

## Basic Example

```typescript
import { TypedAmqpClient } from '@amqp-contract/client';
import { connect } from 'amqplib';
import { contract } from './contract';

async function main() {
  // Connect to RabbitMQ
  const connection = await connect('amqp://localhost');

  // Create client (automatically connects)
  const client = await TypedAmqpClient.create({ contract, connection });

  // Publish message
  await client.publish('orderCreated', {
    orderId: 'ORD-123',
    customerId: 'CUST-456',
    amount: 99.99,
    items: [
      { productId: 'PROD-A', quantity: 2 },
    ],
    createdAt: new Date().toISOString(),
  });

  console.log('Message published!');

  // Cleanup
  await client.close();
  await connection.close();
}

main();
```

## Publishing with Options

```typescript
// Persistent message
await client.publish('orderCreated', message, {
  persistent: true,
});

// Custom routing key
await client.publish('orderCreated', message, {
  routingKey: 'order.created.urgent',
});

// With priority and headers
await client.publish('orderCreated', message, {
  persistent: true,
  priority: 10,
  headers: {
    'x-request-id': 'req-123',
    'x-source': 'api',
  },
});

// With expiration (TTL)
await client.publish('orderCreated', message, {
  expiration: '60000', // 60 seconds
});
```

## Error Handling

```typescript
try {
  await client.publish('orderCreated', message);
} catch (error) {
  if (error.name === 'ZodError') {
    // Schema validation error
    console.error('Invalid message:', error.issues);
  } else {
    // Other error (network, etc.)
    console.error('Publishing failed:', error);
  }
}
```

## Connection Management

```typescript
import { connect } from 'amqplib';

// Create connection
const connection = await connect('amqp://localhost', {
  heartbeat: 30,
  timeout: 5000,
});

// Handle connection errors
connection.on('error', (err) => {
  console.error('Connection error:', err);
});

connection.on('close', () => {
  console.log('Connection closed');
});

// Create and connect client
const client = await TypedAmqpClient.create({ contract, connection });

// Use client...

// Cleanup
await client.close();
await connection.close();
```

## Multiple Clients

You can create multiple clients from the same or different contracts:

```typescript
const orderClient = await TypedAmqpClient.create({
  contract: orderContract,
  connection,
});

const paymentClient = await TypedAmqpClient.create({
  contract: paymentContract,
  connection,
});

// Use both clients
await orderClient.publish('orderCreated', orderMessage);
await paymentClient.publish('paymentProcessed', paymentMessage);
```

## Type Inference

The client provides full type inference for publisher names and message schemas:

```typescript
// TypeScript knows available publishers
client.publish('orderCreated', ...);   // ✅ Valid
client.publish('unknownPublisher', ...); // ❌ TypeScript error

// TypeScript knows message shape
client.publish('orderCreated', {
  orderId: 'ORD-123',    // ✅ Required field
  amount: 99.99,         // ✅ Required field
});

client.publish('orderCreated', {
  orderId: 'ORD-123',    // ❌ Missing 'amount'
});

client.publish('orderCreated', {
  orderId: 123,          // ❌ Wrong type (should be string)
  amount: 99.99,
});
```

## See Also

- [Contract API](/api/contract) - Defining contracts
- [Worker API](/api/worker) - Consuming messages
- [Client Usage Guide](/guide/client-usage)
