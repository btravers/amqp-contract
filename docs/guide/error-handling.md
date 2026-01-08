# Error Handling Guide

This guide covers error handling strategies in `@amqp-contract/worker`, including the retry mechanism, error classification, and Dead Letter Queue integration.

## Overview

The worker package provides a sophisticated error handling system that automatically:

- **Distinguishes** between retryable and non-retryable errors
- **Retries** transient failures (only `RetryableError`) with exponential backoff
- **Routes** failed messages to Dead Letter Queues (DLQ)
- **Tracks** retry attempts using message headers
- **Logs** all error events for debugging

## Error Classes

### RetryableError

Use `RetryableError` for **transient failures** that may succeed on retry:

```typescript
import { RetryableError } from "@amqp-contract/worker";

// Examples of retryable errors
try {
  await externalAPI.call();
} catch (error) {
  if (error instanceof TimeoutError) {
    throw new RetryableError("API timeout", error);
  }
  if (error instanceof RateLimitError) {
    throw new RetryableError("Rate limit exceeded", error);
  }
  if (error.code === "ECONNREFUSED") {
    throw new RetryableError("Connection refused", error);
  }
}
```

**Common use cases:**

- Network timeouts
- Temporary service unavailability
- Rate limiting (HTTP 429)
- Database connection failures
- Deadlock errors
- Circuit breaker open states

### Regular Errors (Non-Retryable by Default)

**By default, regular errors are NOT retried.** This is a safe default that prevents wasting resources on permanent failures:

```typescript
// Examples of errors that should NOT be retried
try {
  await processOrder(message);
} catch (error) {
  if (error instanceof ValidationError) {
    // Regular errors go straight to DLQ - no retry
    throw new Error("Invalid order data");
  }
  if (error.code === "RESOURCE_NOT_FOUND") {
    throw new Error("Product not found");
  }
  if (error.code === "DUPLICATE_KEY") {
    throw new Error("Order already processed");
  }
}
```

**Common use cases for non-retryable errors:**

- Validation errors
- Business logic violations
- Missing required resources
- Authentication/authorization failures
- Duplicate key errors
- Malformed data

### Default Behavior

**Important:** Only `RetryableError` instances trigger the retry mechanism. All other errors (including regular `Error`) are sent directly to the DLQ without retrying:

```typescript
handlers: {
  processOrder: async (message) => {
    // This will NOT be retried - goes straight to DLQ
    throw new Error("Something went wrong");

    // This WILL be retried with exponential backoff
    throw new RetryableError("Temporary issue");
  },
};
```

## Retry Configuration

Configure retry behavior when creating the worker:

```typescript
import { TypedAmqpWorker, RetryableError } from "@amqp-contract/worker";

const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      try {
        await processPayment(message);
      } catch (error) {
        if (error instanceof TimeoutError) {
          throw new RetryableError("Payment timeout", error);
        }
        throw error; // Non-retryable
      }
    },
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3, // Maximum retry attempts (default: 3)
    initialDelayMs: 1000, // Initial delay in ms (default: 1000)
    maxDelayMs: 30000, // Maximum delay in ms (default: 30000)
    backoffMultiplier: 2, // Exponential multiplier (default: 2)
    jitter: true, // Add random jitter (default: true)
  },
}).resultToPromise();
```

### RabbitMQ Plugin Requirement

**IMPORTANT:** The retry mechanism with exponential backoff requires the RabbitMQ delayed message exchange plugin:

```bash
# Enable the plugin on your RabbitMQ broker
rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

The plugin is available at: https://github.com/rabbitmq/rabbitmq-delayed-message-exchange

**How it works:**

- When a `RetryableError` is thrown, the worker calculates an exponential backoff delay
- The message is republished to the **original exchange** with a queue-specific retry routing key (`<queueName>.retry`) and an `x-delay` header containing the delay in milliseconds
- The delayed message exchange plugin intercepts messages with the `x-delay` header and holds them for the specified duration
- After the delay expires, the plugin routes the message to the destination queue via the retry binding where it's consumed and retried

**Contract requirement:** Each retryable queue must have a binding for its retry routing key (`<queueName>.retry`). This ensures retries are queue-specific and don't broadcast to other queues. See the contract examples below for the binding pattern.

**Without this plugin:** Messages will still be retried, but without delays (immediate retry), which may not be suitable for transient failures that need time to recover.

### Configuration Options

#### `maxRetries`

Maximum number of retry attempts before sending to DLQ.

- **Default:** `3`
- **Range:** 0 to ∞
- **Example:** With `maxRetries: 3`, a message will be attempted 4 times total (original + 3 retries)

#### `initialDelayMs`

Initial delay before the first retry, in milliseconds.

- **Default:** `1000` (1 second)
- **Range:** 0 to ∞
- **Example:** With `initialDelayMs: 500`, first retry occurs after 500ms

#### `maxDelayMs`

Maximum delay between retries, in milliseconds. This caps the exponential backoff.

- **Default:** `30000` (30 seconds)
- **Range:** 0 to ∞
- **Example:** With `maxDelayMs: 60000`, delays will never exceed 60 seconds

#### `backoffMultiplier`

Multiplier for exponential backoff calculation.

- **Default:** `2`
- **Range:** 1 to ∞
- **Formula:** `delay = min(initialDelayMs × (multiplier ^ retryCount), maxDelayMs)`
- **Example:** With multiplier `2`: 1s → 2s → 4s → 8s → 16s → 32s (capped)

#### `jitter`

Add random jitter to prevent thundering herd problem.

- **Default:** `true`
- **Effect:** Multiplies delay by a random value between 0.5 and 1.0
- **Purpose:** Prevents all failed messages from retrying simultaneously

### Backoff Examples

**With jitter disabled:**

```
Retry 1: 1000ms
Retry 2: 2000ms
Retry 3: 4000ms
Retry 4: 8000ms
Retry 5: 16000ms
```

**With jitter enabled:**

```
Retry 1: ~750ms  (1000 × 0.75)
Retry 2: ~1600ms (2000 × 0.80)
Retry 3: ~3200ms (4000 × 0.80)
Retry 4: ~7200ms (8000 × 0.90)
Retry 5: ~13600ms (16000 × 0.85)
```

## Dead Letter Queues (DLQ)

Messages are sent to the DLQ when:

1. **Max retries exceeded** for `RetryableError`
2. **Regular errors** thrown (immediately - not retried)
3. **Validation or parsing errors** occur

### Configuring DLQ

Define a Dead Letter Exchange in your contract:

```typescript
import { defineContract, defineExchange, defineQueue } from "@amqp-contract/contract";

const mainExchange = defineExchange("orders", "topic", { durable: true });
const dlqExchange = defineExchange("orders-dlq", "topic", { durable: true });

const orderQueue = defineQueue("order-processing", {
  durable: true,
  deadLetter: {
    exchange: dlqExchange,
    routingKey: "order.failed", // Optional: override routing key
  },
});

const dlqQueue = defineQueue("order-dlq", { durable: true });

const contract = defineContract({
  exchanges: {
    main: mainExchange,
    dlq: dlqExchange,
  },
  queues: {
    orders: orderQueue,
    dlq: dlqQueue,
  },
  bindings: {
    mainBinding: defineQueueBinding(orderQueue, mainExchange, {
      routingKey: "order.#",
    }),
    dlqBinding: defineQueueBinding(dlqQueue, dlqExchange, {
      routingKey: "#",
    }),
  },
  // ... publishers and consumers
});
```

### DLQ Message Headers

Messages in the DLQ include metadata about the failure:

- `x-death` - Array of death history (added by RabbitMQ)
- `x-first-failure-timestamp` - Unix timestamp of first failure
- `x-error-message` - Error message from last failure attempt
- `x-error-name` - Error name/type from last failure attempt

### Processing DLQ Messages

Create a separate consumer to handle failed messages:

```typescript
const dlqWorker = await TypedAmqpWorker.create({
  contract: dlqContract,
  handlers: {
    processDLQ: async (message) => {
      // Log for analysis
      logger.error("Message failed permanently", {
        message,
        headers: message.headers,
      });

      // Optional: Send alert
      await alerting.send({
        title: "Order processing failed",
        message: JSON.stringify(message),
      });

      // Optional: Store for manual review
      await database.storeFailed(message);
    },
  },
  urls: ["amqp://localhost"],
});
```

## Message Headers

The retry mechanism tracks retry attempts using message headers:

### `x-retry-count`

Number of retry attempts for this message.

- Type: `number`
- Initial value: `0`
- Incremented on each retry

### `x-first-failure-timestamp`

Unix timestamp (milliseconds) when the message first failed.

- Type: `number`
- Set on first failure
- Preserved across retries

### `x-error-message`

Error message from the most recent failure.

- Type: `string`
- Updated on each retry
- Helps with debugging

### `x-error-name`

Error name/type from the most recent failure.

- Type: `string`
- Updated on each retry
- Examples: `RetryableError`, `TypeError`, `UnknownError`

## Best Practices

### 1. Be Specific with Error Types

Clearly identify which errors are retryable:

```typescript
handlers: {
  processOrder: async (message) => {
    try {
      await processPayment(message);
    } catch (error) {
      // ✅ Good: Specific error classification
      if (isNetworkError(error)) {
        throw new RetryableError("Network error", error);
      }
      if (isValidationError(error)) {
        // Regular errors are not retried
        throw new Error("Invalid data");
      }

      // ❌ Bad: Re-throwing unknown error without context
      // Note: This will NOT be retried (only RetryableError is retried)
      throw error;
    }
  },
};
```

### 2. Set Appropriate Retry Limits

Consider the nature of your workload:

```typescript
// For critical operations: More retries
retry: {
  maxRetries: 5,
  initialDelayMs: 2000,
  maxDelayMs: 60000,
}

// For non-critical operations: Fewer retries
retry: {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 10000,
}
```

### 3. Monitor DLQ Messages

Always monitor your DLQ for failed messages:

```typescript
// Set up alerting for DLQ messages
const dlqWorker = await TypedAmqpWorker.create({
  contract: dlqContract,
  handlers: {
    monitorDLQ: async (message) => {
      const age = Date.now() - message.properties.timestamp;

      if (age > 3600000) {
        // Alert if message is over 1 hour old
        await alerting.sendCritical("Old DLQ message detected");
      }
    },
  },
  urls: ["amqp://localhost"],
});
```

### 4. Log with Context

Include relevant context in error logs:

```typescript
handlers: {
  processOrder: async (message) => {
    try {
      await processPayment(message);
    } catch (error) {
      logger.error("Payment processing failed", {
        orderId: message.orderId,
        customerId: message.customerId,
        amount: message.amount,
        error: error.message,
        stack: error.stack,
      });

      throw new RetryableError("Payment failed", error);
    }
  },
};
```

### 5. Consider Idempotency

Ensure handlers are idempotent to safely handle retries:

```typescript
handlers: {
  processOrder: async (message) => {
    // ✅ Good: Check if already processed
    const existing = await database.findOrder(message.orderId);
    if (existing) {
      logger.info("Order already processed, skipping");
      return; // Idempotent - safe to retry
    }

    await database.createOrder(message);
  },
};
```

### 6. Use Circuit Breakers

Combine with circuit breaker pattern for external services:

```typescript
import { CircuitBreaker } from "your-circuit-breaker-library";

const paymentBreaker = new CircuitBreaker(paymentService.process);

handlers: {
  processOrder: async (message) => {
    try {
      await paymentBreaker.call(message);
    } catch (error) {
      if (paymentBreaker.isOpen()) {
        // Circuit is open - service is down
        throw new RetryableError("Payment service unavailable", error);
      }
      throw error;
    }
  },
};
```

## Batch Processing

Batch handlers also support retry logic:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processBatch: [
      async (messages) => {
        try {
          await processBatch(messages);
        } catch (error) {
          // All messages in batch are retried together
          throw new RetryableError("Batch processing failed", error);
        }
      },
      { batchSize: 10, batchTimeout: 1000 },
    ],
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 3,
  },
});
```

**Note:** When a batch fails, all messages in the batch are retried individually with their own retry counts.

## Backward Compatibility

The retry mechanism is **opt-in**. If no `retry` configuration is provided, the worker maintains the previous behavior:

- All errors cause messages to be requeued immediately
- No retry limits
- No exponential backoff
- No automatic DLQ routing

```typescript
// Old behavior (without retry config)
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    processOrder: async (message) => {
      // Errors cause immediate requeue
      throw new Error("Will requeue immediately");
    },
  },
  urls: ["amqp://localhost"],
  // No retry config = old behavior
});
```

## Troubleshooting

### Messages Not Retrying

**Problem:** Messages go straight to DLQ without retrying.

**Solutions:**

1. Check if you're throwing regular `Error` instead of `RetryableError` (only `RetryableError` triggers retries)
2. Verify `maxRetries` is greater than 0
3. Check if DLQ is configured on the queue
4. Review worker logs for error messages

### Excessive Retries

**Problem:** Messages retry too many times.

**Solutions:**

1. Reduce `maxRetries` value
2. Use regular `Error` instead of `RetryableError` for permanent failures
3. Verify external services are healthy
4. Review error logs to identify root cause

### Delays Too Short/Long

**Problem:** Retry delays don't match expectations.

**Solutions:**

1. Adjust `initialDelayMs` and `maxDelayMs`
2. Modify `backoffMultiplier` for faster/slower growth
3. Disable `jitter` for predictable delays (not recommended for production)
4. Review worker logs for actual delay values

## Related

- [Worker Usage Guide](./worker-usage.md)
- [Worker NestJS Usage](./worker-nestjs-usage.md)
- [Defining Contracts](./defining-contracts.md)
- [Testing Guide](./testing.md)
