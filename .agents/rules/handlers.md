# Handler Patterns

## Handler Signature

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

## Handler Parameters

1. **`message`**: Object containing `{ payload, headers }`
   - `payload`: Validated message data (typed from schema)
   - `headers`: Validated headers (if schema defines them)

2. **`rawMessage`**: Raw AMQP `ConsumeMessage` with full metadata
   - `fields.deliveryTag`, `fields.routingKey`, `fields.exchange`
   - `properties.messageId`, `properties.timestamp`, etc.

## Using defineHandler

Use `defineHandler` for all new code to get full type inference from the contract:

```typescript
import { defineHandler, RetryableError, NonRetryableError } from "@amqp-contract/worker";
import { Future, Result } from "@swan-io/boxed";

const processOrderHandler = defineHandler(contract, "processOrder", ({ payload }) =>
  Future.fromPromise(processPayment(payload.orderId))
    .mapOk(() => undefined)
    .mapError((error) => new RetryableError("Payment service unavailable", error)),
);

// For permanent failures
const validateOrderHandler = defineHandler(contract, "validateOrder", ({ payload }) => {
  if (payload.amount < 1) {
    return Future.value(Result.Error(new NonRetryableError("Invalid amount")));
  }
  return Future.value(Result.Ok(undefined));
});
```

## Error Types

- **`RetryableError`**: Transient failures — message retried with backoff
- **`NonRetryableError`**: Permanent failures — message sent to DLQ immediately
- Both extend `HandlerError` base class
- Factory functions: `retryable()`, `nonRetryable()` (shorthand)
- Type guards: `isRetryableError()`, `isNonRetryableError()`, `isHandlerError()`

```typescript
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

## Handler Options

```typescript
const handlers = {
  processOrder: [
    processOrderHandler,
    { prefetch: 10 }, // Process up to 10 messages concurrently
  ],
  processBatch: [
    batchHandler,
    { batchSize: 5, batchTimeout: 1000 }, // Batch 5 messages or 1s timeout
  ],
};
```

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
