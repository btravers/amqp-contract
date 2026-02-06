# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For detailed coding standards, anti-patterns, and comprehensive examples, see [.github/copilot-instructions.md](.github/copilot-instructions.md).

## Project Overview

**amqp-contract** is a TypeScript monorepo providing type-safe contracts for AMQP/RabbitMQ messaging with automatic runtime validation.

## Commands

### Development

```bash
pnpm build            # Build all packages
pnpm dev              # Watch mode for development
```

### Code Quality

```bash
pnpm typecheck        # Type check without emitting
pnpm lint             # Run oxlint (no any types, type aliases)
pnpm lint --fix       # Auto-fix linting issues
pnpm format           # Format with oxfmt (import sorting)
pnpm format --check   # Check formatting only
```

### Testing

```bash
pnpm test             # Run unit tests (no Docker required)
pnpm test:integration # Run integration tests (requires Docker)

# Run specific package tests
pnpm test:integration --filter @amqp-contract/core
pnpm test:integration --filter @amqp-contract/client
pnpm test:integration --filter @amqp-contract/worker
```

### Versioning

```bash
pnpm changeset        # Create changeset entry for version bumps
```

## Architecture

### Core Packages

| Package                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `@amqp-contract/contract`      | Contract definition builder and types (foundation)           |
| `@amqp-contract/core`          | AMQP connection management, topology setup, telemetry        |
| `@amqp-contract/client`        | Type-safe publishing via `TypedAmqpClient`                   |
| `@amqp-contract/worker`        | Type-safe consumption via `TypedAmqpWorker` with retry logic |
| `@amqp-contract/client-nestjs` | NestJS module for client                                     |
| `@amqp-contract/worker-nestjs` | NestJS module for worker                                     |
| `@amqp-contract/asyncapi`      | AsyncAPI 3.0 specification generator                         |
| `@amqp-contract/testing`       | Testcontainers setup and vitest fixtures                     |

### Contract Composition Pattern

Resources are defined individually then composed into a contract. `defineContract` only accepts `publishers` and `consumers` - exchanges, queues, and bindings are automatically extracted and inferred:

```typescript
const dlx = defineExchange("orders-dlx", "direct", { durable: true });
const exchange = defineExchange("orders", "topic", { durable: true });
const queue = defineQueue("processing", {
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
  deliveryLimit: 5,
});
const message = defineMessage(z.object({ orderId: z.string() }));

// Define event publisher
const orderCreatedEvent = defineEventPublisher(exchange, message, { routingKey: "order.created" });

// Compose contract - only publishers and consumers are specified
// Exchanges, queues, and bindings are automatically extracted
const contract = defineContract({
  publishers: { orderCreated: orderCreatedEvent },
  consumers: { processOrder: defineEventConsumer(orderCreatedEvent, queue) },
});

// contract.exchanges contains: { orders: exchange, 'orders-dlx': dlx }
// contract.queues contains: { processing: queue }
// contract.bindings contains: { processOrderBinding: ... }
```

### Event and Command Patterns

Use these patterns for type-safe publisher/consumer relationships:

| Pattern     | Use Case                                   | Flow                                               |
| ----------- | ------------------------------------------ | -------------------------------------------------- |
| **Event**   | One publisher, many consumers (broadcast)  | `defineEventPublisher` → `defineEventConsumer`     |
| **Command** | Many publishers, one consumer (task queue) | `defineCommandConsumer` → `defineCommandPublisher` |

```typescript
// Event Pattern: Publisher broadcasts, multiple consumers subscribe
const orderCreatedEvent = defineEventPublisher(ordersExchange, orderMessage, {
  routingKey: "order.created",
});

// Consumer can override routing key for topic exchanges
const allOrdersConsumer = defineEventConsumer(orderCreatedEvent, allOrdersQueue, {
  routingKey: "order.*", // Pattern to receive multiple events
});

// Command Pattern: Consumer owns the queue, publishers send to it
const processOrderCommand = defineCommandConsumer(orderQueue, ordersExchange, orderMessage, {
  routingKey: "order.process",
});

// For topic exchanges, publisher can specify concrete routing key
const createOrderPublisher = defineCommandPublisher(processOrderCommand, {
  routingKey: "order.create",
});

// Compose contract - only publishers and consumers are specified
// Exchanges, queues, and bindings are automatically extracted
const contract = defineContract({
  publishers: {
    orderCreated: orderCreatedEvent,
    createOrder: createOrderPublisher,
  },
  consumers: {
    processOrder: defineEventConsumer(orderCreatedEvent, processingQueue),
    allOrders: allOrdersConsumer,
    handleOrder: processOrderCommand,
  },
});
// contract.exchanges, contract.queues, and contract.bindings are auto-populated
```

### Retry Configuration

Retry strategy is configured at the queue level in the contract, not at the handler level:

- **TTL-Backoff Mode**: Uses wait queues with exponential backoff. Infrastructure is **automatically generated** when `defineQueue` is called with TTL-backoff retry and a dead letter exchange.
- **Quorum-Native Mode**: Uses RabbitMQ's native `x-delivery-limit` feature. Simpler, no wait queues needed.

```typescript
// TTL-backoff (configurable delays) - infrastructure auto-generated
const queue = defineQueue("orders", {
  deadLetter: { exchange: dlx },
  retry: {
    mode: "ttl-backoff",
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
});

// Quorum-native (immediate retries)
const queue = defineQueue("orders", {
  deliveryLimit: 5,
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
});

// When you need to access the underlying queue definition (e.g., for queue name),
// use extractQueue() since TTL-backoff queues return a wrapper object:
import { extractQueue } from "@amqp-contract/contract";
const queueName = extractQueue(queue).name;
```

### Type Inference Helpers

The `Infer*` naming pattern indicates type inference helpers that extract types from a contract at compile time.

- `ClientInferPublisherInput<Contract, "publisherName">` - Publisher input type
- `WorkerInferConsumerInput<Contract, "consumerName">` - Consumer input type
- `WorkerInferConsumerHandler<Contract, "consumerName">` - Handler type
- `WorkerInferConsumedMessage<Contract, "consumerName">` - Full message type (payload + headers)

## Handler Patterns (Critical)

### Handler Signature (Required for new code)

Handlers receive `({ payload, headers }, rawMessage)` and return `Future<Result<void, HandlerError>>`:

```typescript
import { Future, Result } from "@swan-io/boxed";
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";

// Handler signature: (message, rawMessage) => Future<Result<void, HandlerError>>
const handler = ({ payload }, rawMessage) => {
  console.log(payload.orderId);
  return Future.value(Result.Ok(undefined));
};

// For async operations, use Future.fromPromise
const asyncHandler = ({ payload }) =>
  Future.fromPromise(processPayment(payload))
    .mapOk(() => undefined)
    .mapError((error) => new RetryableError("Payment failed", error));
```

### Handler Parameters

1. **`message`**: Object containing `{ payload, headers }`
   - `payload`: Validated message data (typed from schema)
   - `headers`: Validated headers (if schema defines them)

2. **`rawMessage`**: Raw AMQP `ConsumeMessage` with full metadata
   - `fields.deliveryTag`, `fields.routingKey`, `fields.exchange`
   - `properties.messageId`, `properties.timestamp`, etc.

### Error Types

- **`RetryableError`**: Transient failures → message retried with backoff
- **`NonRetryableError`**: Permanent failures → message sent to DLQ immediately

## @swan-io/boxed API Reference

This project uses [@swan-io/boxed](https://boxed.cool) for functional error handling.

### Future<Result<A, E>> Key Methods

| Method                        | Description                           | Example                                         |
| ----------------------------- | ------------------------------------- | ----------------------------------------------- |
| `Future.value(result)`        | Create resolved Future                | `Future.value(Result.Ok(undefined))`            |
| `Future.fromPromise(promise)` | Convert Promise to Future<Result>     | `Future.fromPromise(fetch(url))`                |
| `.mapOk(f)`                   | Transform Ok value                    | `.mapOk(() => undefined)`                       |
| `.mapError(f)`                | Transform Error value                 | `.mapError((e) => new RetryableError(e))`       |
| `.flatMapOk(f)`               | Chain with another Future             | `.flatMapOk((v) => Future.value(Result.Ok(v)))` |
| `.resultToPromise()`          | Convert to Promise (rejects on Error) | `await future.resultToPromise()`                |

### Result<Ok, Error> Key Methods

| Method                   | Description           | Example                                        |
| ------------------------ | --------------------- | ---------------------------------------------- |
| `Result.Ok(value)`       | Create success        | `Result.Ok(undefined)`                         |
| `Result.Error(error)`    | Create failure        | `Result.Error(new RetryableError("failed"))`   |
| `.isOk()` / `.isError()` | Type guards           | `if (result.isOk()) { ... }`                   |
| `.map(f)`                | Transform Ok          | `result.map(x => x * 2)`                       |
| `.mapError(f)`           | Transform Error       | `result.mapError(e => new Error(e))`           |
| `.getOr(default)`        | Extract with fallback | `result.getOr(0)`                              |
| `.match({ Ok, Error })`  | Pattern match         | `result.match({ Ok: v => v, Error: () => 0 })` |

### Common Patterns

```typescript
// Simple sync handler
({ payload }) => Future.value(Result.Ok(undefined));

// Async with error mapping
({ payload }) =>
  Future.fromPromise(asyncOperation(payload))
    .mapOk(() => undefined)
    .mapError((error) => new RetryableError("Failed", error));

// Conditional error handling
({ payload }) =>
  Future.fromPromise(process(payload))
    .mapOk(() => undefined)
    .mapError((error) => {
      if (error instanceof ValidationError) {
        return new NonRetryableError("Invalid data");
      }
      return new RetryableError("Temporary failure", error);
    });
```

## Worker Package Exports

```typescript
// Worker class
export { TypedAmqpWorker } from "@amqp-contract/worker";

// Handler definition
export { defineHandler, defineHandlers } from "@amqp-contract/worker";

// Error classes and factory functions
export {
  RetryableError,
  NonRetryableError,
  TechnicalError,
  MessageValidationError,
  // Factory functions (shorthand)
  retryable,
  nonRetryable,
  // Type guards
  isRetryableError,
  isNonRetryableError,
  isHandlerError,
} from "@amqp-contract/worker";

// Types
export type {
  HandlerError,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlers,
  WorkerInferConsumedMessage,
} from "@amqp-contract/worker";

// Retry types and helpers (from contract package)
export type { TtlBackoffRetryOptions, QuorumNativeRetryOptions } from "@amqp-contract/contract";
export { extractQueue, defineQuorumQueue, defineTtlBackoffQueue } from "@amqp-contract/contract";
```

## Code Style Requirements

- **No `any` types** - enforced by oxlint
- **Type aliases over interfaces** - use `type Foo = {}` not `interface Foo {}`
- **`.js` extensions required** - all imports must include `.js` extension (ESM requirement)
- **Standard Schema v1** - for runtime validation (zod, valibot, arktype supported)
- **Catalog dependencies** - use `pnpm-workspace.yaml` catalog, not hardcoded versions
- **Future/Result handlers** - always use `Future<Result<void, HandlerError>>`, not `async`

## Testing Strategy

- **Integration tests preferred** - real RabbitMQ via testcontainers, not mocking
- **Test file naming**: `*.spec.ts` for unit tests, `src/__tests__/*.spec.ts` for integration
- **Test isolation** - each integration test uses separate RabbitMQ vhost
- **Handler testing** - handlers return `Future.value(Result.Ok(undefined))` in mocks

```typescript
// Test handler mock
const mockHandler = vi.fn().mockReturnValue(Future.value(Result.Ok(undefined)));

// Assertion pattern
expect(mockHandler).toHaveBeenCalledWith(
  expect.objectContaining({
    payload: expect.objectContaining({ orderId: "123" }),
  }),
  expect.anything(), // rawMessage
);
```

## Key Dependencies

| Package                   | Version | Purpose                                |
| ------------------------- | ------- | -------------------------------------- |
| `@swan-io/boxed`          | 3.2.1   | Future/Result functional types         |
| `amqplib`                 | 0.10.9  | AMQP 0.9.1 client                      |
| `amqp-connection-manager` | 5.0.0   | Connection management                  |
| `zod`                     | 4.3.6   | Schema validation (Standard Schema v1) |
| `valibot`                 | 1.2.0   | Schema validation alternative          |
| `arktype`                 | 2.1.29  | Schema validation alternative          |
| `@standard-schema/spec`   | 1.1.0   | Universal schema interface             |
| `vitest`                  | 4.0.18  | Test framework                         |
| `testcontainers`          | 11.11.0 | Docker containers for tests            |

## Monorepo Tooling

- **Package manager**: pnpm 10.28.2
- **Build**: turbo + tsdown (generates CJS/ESM with TypeScript definitions)
- **Linting**: oxlint (Rust-based, enforces strict type rules)
- **Formatting**: oxfmt (Rust-based)
- **Pre-commit**: lefthook (runs format, lint, sort-package-json, commitlint)
- **Commits**: conventional commits required (feat, fix, docs, chore, test, refactor)

## Common Anti-Patterns

```typescript
// ❌ Using async handlers
processOrder: async ({ payload }) => {
  await process(payload);
};

// ✅ Use Future/Result pattern
processOrder: ({ payload }) =>
  Future.fromPromise(process(payload))
    .mapOk(() => undefined)
    .mapError((e) => new RetryableError("Failed", e));

// ❌ Accessing message directly
processOrder: (message) => {
  console.log(message.orderId);
};

// ✅ Destructure payload
processOrder: ({ payload }) => {
  console.log(payload.orderId);
};

// ❌ Using classic queues without retry config
defineQueue("orders", { type: "classic" });

// ✅ Use quorum queues with retry config
defineQueue("orders", {
  deadLetter: { exchange: dlx },
  retry: { mode: "quorum-native" },
  deliveryLimit: 3,
});

// ❌ Accessing .name directly on TTL-backoff queue
const queue = defineQueue("orders", {
  deadLetter: { exchange: dlx },
  retry: { mode: "ttl-backoff" },
});
console.log(queue.name); // Error: queue may be a wrapper object

// ✅ Use extractQueue() to access queue properties
import { extractQueue } from "@amqp-contract/contract";
console.log(extractQueue(queue).name);
```
