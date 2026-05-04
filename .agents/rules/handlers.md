# Handler Patterns

## Handler Signature

Handlers receive `({ payload, headers }, rawMessage)` and return `ResultAsync<void, HandlerError>`:

```typescript
import { ResultAsync, Result } from "neverthrow";
import { RetryableError, NonRetryableError } from "@amqp-contract/worker";

// Handler signature: (message, rawMessage) => ResultAsync<void, HandlerError>
const handler = ({ payload }, rawMessage) => {
  console.log(payload.orderId);
  return okAsync(undefined);
};

// For async operations, use ResultAsync.fromPromise
const asyncHandler = ({ payload }) =>
  ResultAsync.fromPromise(processPayment(payload))
    .map(() => undefined)
    .mapErr((error) => new RetryableError("Payment failed", error));
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
import { ResultAsync, Result } from "neverthrow";

const processOrderHandler = defineHandler(contract, "processOrder", ({ payload }) =>
  ResultAsync.fromPromise(processPayment(payload.orderId))
    .map(() => undefined)
    .mapErr((error) => new RetryableError("Payment service unavailable", error)),
);

// For permanent failures
const validateOrderHandler = defineHandler(contract, "validateOrder", ({ payload }) => {
  if (payload.amount < 1) {
    return errAsync(new NonRetryableError("Invalid amount"));
  }
  return okAsync(undefined);
});
```

## Error Types

- **`RetryableError`**: Transient failures — message retried
- **`NonRetryableError`**: Permanent failures — message sent to DLQ (if configured) or dropped
- Both extend `HandlerError` base class
- Factory functions: `retryable()`, `nonRetryable()` (shorthand)
- Type guards: `isRetryableError()`, `isNonRetryableError()`, `isHandlerError()`

```typescript
// Conditional error handling
({ payload }) =>
  ResultAsync.fromPromise(process(payload))
    .map(() => undefined)
    .mapErr((error) => {
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
};
```

## neverthrow API Reference

This project uses [neverthrow](https://github.com/supermacro/neverthrow) for functional error handling.

### ResultAsync<A, E> Key Methods

| Method                             | Description                            | Example                                 |
| ---------------------------------- | -------------------------------------- | --------------------------------------- |
| `ResultAsync.value(result)`        | Create resolved ResultAsync            | `okAsync(undefined)`                    |
| `ResultAsync.fromPromise(promise)` | Convert Promise to ResultAsync<Result> | `ResultAsync.fromPromise(fetch(url))`   |
| `.map(f)`                          | Transform Ok value                     | `.map(() => undefined)`                 |
| `.mapErr(f)`                       | Transform Error value                  | `.mapErr((e) => new RetryableError(e))` |
| `.andThen(f)`                      | Chain with another ResultAsync         | `.andThen((v) => okAsync(v))`           |
| ``                                 | Convert to Promise (rejects on Error)  | `await future`                          |

### Result<Ok, Error> Key Methods

| Method                  | Description           | Example                                        |
| ----------------------- | --------------------- | ---------------------------------------------- |
| `ok(value)`             | Create success        | `ok(undefined)`                                |
| `err(error)`            | Create failure        | `err(new RetryableError("failed"))`            |
| `.isOk()` / `.isErr()`  | Type guards           | `if (result.isOk()) { ... }`                   |
| `.map(f)`               | Transform Ok          | `result.map(x => x * 2)`                       |
| `.mapErr(f)`            | Transform Error       | `result.mapErr(e => new Error(e))`             |
| `.getOr(default)`       | Extract with fallback | `result.getOr(0)`                              |
| `.match({ Ok, Error })` | Pattern match         | `result.match({ Ok: v => v, Error: () => 0 })` |

### Common Patterns

```typescript
// Simple sync handler
({ payload }) => okAsync(undefined);

// Async with error mapping
({ payload }) =>
  ResultAsync.fromPromise(asyncOperation(payload))
    .map(() => undefined)
    .mapErr((error) => new RetryableError("Failed", error));
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
export type { TtlBackoffRetryOptions, ImmediateRequeueRetryOptions } from "@amqp-contract/contract";
export { extractQueue } from "@amqp-contract/contract";
```
