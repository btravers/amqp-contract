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
pnpm lint             # Run oxlint (no any types, import sorting, type aliases)
pnpm lint --fix       # Auto-fix linting issues
pnpm format           # Format with oxfmt
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

Resources are defined individually then composed into a contract:

```typescript
const dlx = defineExchange("orders-dlx", "direct", { durable: true });
const exchange = defineExchange("orders", "topic", { durable: true });
const queue = defineQueue("processing", {
  deadLetter: { exchange: dlx },
  retry: { mode: "ttl-backoff", maxRetries: 5 },
});
const message = defineMessage(z.object({ orderId: z.string() }));

// TTL-backoff infrastructure (wait queue, bindings) is automatically generated
// when defineQueue is called with TTL-backoff retry and a dead letter exchange
const contract = defineContract({
  exchanges: { orders: exchange, dlx },
  queues: { processing: queue },
  publishers: { orderCreated: definePublisher(exchange, message, { routingKey: "order.created" }) },
  consumers: { processOrder: defineConsumer(queue, message) },
  bindings: { binding1: defineQueueBinding(queue, exchange, { routingKey: "order.#" }) },
});
// defineContract automatically expands the queue into:
// - processing: main queue
// - processingWait: wait queue with TTL
// And adds bindings for retry routing
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

- `ClientInferPublisherInput<Contract, "publisherName">` - Publisher input type
- `WorkerInferConsumerInput<Contract, "consumerName">` - Consumer input type
- `WorkerInferSafeConsumerHandler<Contract, "consumerName">` - Handler type
- `WorkerInferConsumedMessage<Contract, "consumerName">` - Full message type (payload + headers)

## Handler Patterns (Critical)

### Safe Handler Signature (Required for new code)

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

// Error classes
export {
  RetryableError,
  NonRetryableError,
  TechnicalError,
  MessageValidationError,
} from "@amqp-contract/worker";

// Types
export type {
  HandlerError,
  WorkerInferSafeConsumerHandler,
  WorkerInferSafeConsumerHandlers,
  WorkerInferConsumedMessage,
} from "@amqp-contract/worker";

// Retry types and helpers (from contract package)
export type { TtlBackoffRetryOptions, QuorumNativeRetryOptions } from "@amqp-contract/contract";
export { extractQueue } from "@amqp-contract/contract";
```

## Code Style Requirements

- **No `any` types** - enforced by oxlint
- **Type aliases over interfaces** - use `type Foo = {}` not `interface Foo {}`
- **`.js` extensions required** - all imports must include `.js` extension (ESM requirement)
- **Standard Schema v1** - for runtime validation (zod, valibot, arktype supported)
- **Catalog dependencies** - use `pnpm-workspace.yaml` catalog, not hardcoded versions
- **Safe handlers** - always use `Future<Result<void, HandlerError>>`, not `async`

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
| `zod`                     | 4.3.5   | Schema validation (Standard Schema v1) |
| `valibot`                 | 1.2.0   | Schema validation alternative          |
| `arktype`                 | 2.1.29  | Schema validation alternative          |
| `@standard-schema/spec`   | 1.1.0   | Universal schema interface             |
| `vitest`                  | 4.0.17  | Test framework                         |
| `testcontainers`          | 11.11.0 | Docker containers for tests            |

## Monorepo Tooling

- **Package manager**: pnpm 10.27.0
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
