# Client Usage

Learn how to use the type-safe AMQP client to publish messages.

::: tip NestJS Users
For NestJS applications, see the [NestJS Client Usage](/guide/client-nestjs-usage) guide.
:::

## Creating a Client

Create a type-safe client from your contract. The `create` method returns a `Future<Result<...>>` that must be awaited:

```typescript
import { TypedAmqpClient } from "@amqp-contract/client";
import { contract } from "./contract";

const clientResult = await TypedAmqpClient.create({
  contract,
  urls: ["amqp://localhost"],
});

// Handle connection errors
if (clientResult.isError()) {
  console.error("Failed to create client:", clientResult.error);
  throw clientResult.error; // or handle appropriately
}

const client = clientResult.get();
```

## Publishing Messages

Publish messages with full type safety and explicit error handling:

```typescript
const result = await client
  .publish("orderCreated", {
    orderId: "ORD-123",
    customerId: "CUST-456",
    amount: 99.99,
    items: [{ productId: "PROD-A", quantity: 2 }],
  })
  .resultToPromise();

result.match({
  Ok: () => console.log("✅ Published"),
  Error: (error) => console.error("❌ Failed:", error.message),
});
```

### Type Safety

The client enforces:

- ✅ **Valid publisher names** - Only publishers from contract
- ✅ **Message schema** - Messages must match schema
- ✅ **Autocomplete** - Full IDE support
- ✅ **Explicit errors** - Returned via `Result` type

```typescript
// ❌ TypeScript error: 'unknownPublisher' not in contract
const result = await client.publish('unknownPublisher', { ... }).resultToPromise();

// ❌ TypeScript error: missing required field
const result = await client.publish('orderCreated', {
  customerId: 'CUST-456',
}).resultToPromise();

// ❌ Runtime validation error returned in Result
const result = await client.publish('orderCreated', {
  orderId: 123, // should be string
  customerId: 'CUST-456',
  amount: 99.99,
}).resultToPromise();

result.match({
  Ok: () => console.log('Published'),
  Error: (error) => console.error('Validation failed:', error),
});
```

## Publishing Options

### Custom Routing Key

Override the routing key for specific messages:

```typescript
const result = await client
  .publish(
    "orderCreated",
    { orderId: "ORD-123", amount: 99.99 },
    { routingKey: "order.created.urgent" },
  )
  .resultToPromise();
```

### Message Properties

Set AMQP message properties:

```typescript
const result = await client
  .publish(
    "orderCreated",
    { orderId: "ORD-123", amount: 99.99 },
    {
      options: {
        persistent: true,
        priority: 10,
        headers: { "x-request-id": "req-123" },
      },
    },
  )
  .resultToPromise();
```

## Connection Management

### Closing the Connection

```typescript
await client.close();
```

### Error Handling

Errors are returned via `Result` types, not thrown:

```typescript
import { MessageValidationError, TechnicalError } from "@amqp-contract/client";
import { match, P } from "ts-pattern";

const result = await client
  .publish("orderCreated", {
    orderId: "ORD-123",
    amount: 99.99,
  })
  .resultToPromise();

result.match({
  Ok: () => console.log("✅ Published"),
  Error: (error) =>
    match(error)
      .with(P.instanceOf(MessageValidationError), (err) =>
        console.error("Validation failed:", err.issues),
      )
      .with(P.instanceOf(TechnicalError), (err) => console.error("Technical error:", err.message))
      .exhaustive(),
});
```

**Error Types:**

- `MessageValidationError` - Schema validation failed
- `TechnicalError` - Network or runtime failures

**Note:** Programming errors (like invalid publisher name) still throw exceptions, since TypeScript should catch those at compile-time.

## Complete Example

```typescript
import { TypedAmqpClient } from "@amqp-contract/client";
import { MessageValidationError, TechnicalError } from "@amqp-contract/client";
import { match, P } from "ts-pattern";
import { contract } from "./contract";

async function main() {
  let client;

  try {
    client = await TypedAmqpClient.create({
      contract,
      urls: ["amqp://localhost"],
    }).resultToPromise();

    const result = await client
      .publish("orderCreated", {
        orderId: "ORD-123",
        customerId: "CUST-456",
        amount: 99.99,
        items: [{ productId: "PROD-A", quantity: 2 }],
      })
      .resultToPromise();

    result.match({
      Ok: () => console.log("✅ Message published"),
      Error: (error) =>
        match(error)
          .with(P.instanceOf(MessageValidationError), (err) =>
            console.error("❌ Validation failed:", err.issues),
          )
          .with(P.instanceOf(TechnicalError), (err) =>
            console.error("❌ Technical error:", err.message),
          )
          .exhaustive(),
    });
  } catch (error) {
    console.error("Unexpected error:", error);
  } finally {
    await client?.close();
  }
}

main();
```

## Next Steps

- Learn about [Worker Usage](/guide/worker-usage)
- Explore [Defining Contracts](/guide/defining-contracts)
- Check out [Examples](/examples/)
