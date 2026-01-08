# Error Handling Guide

This guide covers error handling strategies in `@amqp-contract/worker`, including the retry mechanism, error classification, and Dead Letter Queue integration.

## Overview

The worker package provides a sophisticated error handling system that automatically:

- **Distinguishes** between retryable and non-retryable errors
- **Retries** transient failures with exponential backoff
- **Routes** permanently failed messages to Dead Letter Queues (DLQ)
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

### NonRetryableError

Use `NonRetryableError` for **permanent failures** that will never succeed:

```typescript
import { NonRetryableError } from "@amqp-contract/worker";

// Examples of non-retryable errors
try {
  await processOrder(message);
} catch (error) {
  if (error instanceof ValidationError) {
    throw new NonRetryableError("Invalid order data", error);
  }
  if (error.code === "RESOURCE_NOT_FOUND") {
    throw new NonRetryableError("Product not found", error);
  }
  if (error.code === "DUPLICATE_KEY") {
    throw new NonRetryableError("Order already processed", error);
  }
}
```

**Common use cases:**

- Validation errors
- Business logic violations
- Missing required resources
- Authentication/authorization failures
- Duplicate key errors
- Malformed data

### Unknown Errors

**By default, unknown errors are treated as retryable.** This is a safe default that prevents permanent data loss:

```typescript
handlers: {
  processOrder: async (message) => {
    // This will be retried
    throw new Error("Something went wrong");
  },
};
```

## Retry Configuration

Configure retry behavior when creating the worker:

```typescript
const worker = await TypedAmqpWorker.create({
  contract,
  handlers: {
    /* ... */
  },
  urls: ["amqp://localhost"],
  retry: {
    maxRetries: 5, // Max retry attempts (default: 3)
    initialDelayMs: 1000, // Initial delay in ms (default: 1000)
    maxDelayMs: 60000, // Max delay in ms (default: 30000)
    backoffMultiplier: 2, // Exponential multiplier (default: 2)
    jitter: true, // Add random jitter (default: true)
  },
});
```

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
2. **NonRetryableError** thrown (immediately)
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
- `x-last-error` - Error message from last failure attempt

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

### `x-last-error`

Error message from the most recent failure.

- Type: `string`
- Updated on each retry
- Helps with debugging

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
        throw new NonRetryableError("Invalid data", error);
      }

      // ❌ Bad: Re-throwing unknown error without context
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

1. Check if you're throwing `NonRetryableError` (these skip retries)
2. Verify `maxRetries` is greater than 0
3. Check if DLQ is configured on the queue
4. Review worker logs for "Non-retryable error" messages

### Excessive Retries

**Problem:** Messages retry too many times.

**Solutions:**

1. Reduce `maxRetries` value
2. Check if errors are correctly classified as `NonRetryableError`
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
