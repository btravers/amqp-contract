import {
  type ConsumerDefinition,
  type ResolvedImmediateRequeueRetryOptions,
  type ResolvedTtlBackoffRetryOptions,
  extractQueue,
  isQueueWithTtlBackoffInfrastructure,
} from "@amqp-contract/contract";
import { type AmqpClient, type Logger, TechnicalError } from "@amqp-contract/core";
import { Future, Result } from "@swan-io/boxed";
import type { ConsumeMessage } from "amqplib";
import { NonRetryableError } from "./errors.js";

type RetryContext = {
  amqpClient: AmqpClient;
  logger?: Logger | undefined;
};

/**
 * Handle error in message processing with retry logic.
 *
 * Flow depends on retry mode:
 *
 * **immediate-requeue mode:**
 * 1. If NonRetryableError -> send directly to DLQ (no retry)
 * 2. If max retries exceeded -> send to DLQ
 * 3. Otherwise -> requeue immediately for retry
 *
 * **ttl-backoff mode:**
 * 1. If NonRetryableError -> send directly to DLQ (no retry)
 * 2. If max retries exceeded -> send to DLQ
 * 3. Otherwise -> publish to wait queue with TTL for retry
 *
 * **none mode (no retry config):**
 * 1. send directly to DLQ (no retry)
 */
export function handleError(
  ctx: RetryContext,
  error: Error,
  msg: ConsumeMessage,
  consumerName: string,
  consumer: ConsumerDefinition,
): Future<Result<void, TechnicalError>> {
  // NonRetryableError -> send directly to DLQ without retrying
  if (error instanceof NonRetryableError) {
    ctx.logger?.error("Non-retryable error, sending to DLQ immediately", {
      consumerName,
      errorType: error.name,
      error: error.message,
    });
    sendToDLQ(ctx, msg, consumer);
    return Future.value(Result.Ok(undefined));
  }

  // Get retry config from the queue definition in the contract
  const config = extractQueue(consumer.queue).retry;

  // Immediate-requeue mode: requeue the message immediately
  if (config.mode === "immediate-requeue") {
    return handleErrorImmediateRequeue(ctx, error, msg, consumerName, consumer, config);
  }

  // TTL-backoff mode: use wait queue with exponential backoff
  if (config.mode === "ttl-backoff") {
    return handleErrorTtlBackoff(ctx, error, msg, consumerName, consumer, config);
  }

  // None mode: no retry, send directly to DLQ or reject
  ctx.logger?.warn("Retry disabled (none mode), sending to DLQ", {
    consumerName,
    error: error.message,
  });
  sendToDLQ(ctx, msg, consumer);
  return Future.value(Result.Ok(undefined));
}

/**
 * Handle error by requeuing immediately.
 *
 * For quorum queues, messages are requeued with `nack(requeue=true)`, and the worker tracks delivery count via the native RabbitMQ `x-delivery-count` header.
 * For classic queues, messages are re-published on the same queue, and the worker tracks delivery count via a custom `x-retry-count` header.
 * When the count exceeds `maxRetries`, the message is automatically dead-lettered (if DLX is configured) or dropped.
 *
 * This is simpler than TTL-based retry but provides immediate retries only.
 */
function handleErrorImmediateRequeue(
  ctx: RetryContext,
  error: Error,
  msg: ConsumeMessage,
  consumerName: string,
  consumer: ConsumerDefinition,
  config: ResolvedImmediateRequeueRetryOptions,
): Future<Result<void, TechnicalError>> {
  const queue = extractQueue(consumer.queue);
  const queueName = queue.name;

  // Get retry count from headers
  // For quorum queues, the header x-delivery-count is automatically incremented on each delivery attempt
  // For classic queues, the header x-retry-count is manually incremented by the worker when re-publishing messages
  const retryCount =
    queue.type === "quorum"
      ? ((msg.properties.headers?.["x-delivery-count"] as number) ?? 0)
      : ((msg.properties.headers?.["x-retry-count"] as number) ?? 0);

  // Max retries exceeded -> DLQ
  if (retryCount >= config.maxRetries) {
    ctx.logger?.error("Max retries exceeded, sending to DLQ (immediate-requeue mode)", {
      consumerName,
      queueName,
      retryCount,
      maxRetries: config.maxRetries,
      error: error.message,
    });
    sendToDLQ(ctx, msg, consumer);
    return Future.value(Result.Ok(undefined));
  }

  ctx.logger?.warn("Retrying message (immediate-requeue mode)", {
    consumerName,
    queueName,
    retryCount,
    maxRetries: config.maxRetries,
    error: error.message,
  });

  if (queue.type === "quorum") {
    // For quorum queues, nack with requeue=true to trigger native retry mechanism
    ctx.amqpClient.nack(msg, false, true);
    return Future.value(Result.Ok(undefined));
  } else {
    // For classic queues, re-publish the message to the same exchange / routing key immediately with an incremented x-retry-count header
    return publishForRetry(ctx, {
      msg,
      exchange: msg.fields.exchange,
      routingKey: msg.fields.routingKey,
      queueName,
      error,
    });
  }
}

/**
 * Handle error using TTL + wait queue pattern for exponential backoff.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Retry Flow (Native RabbitMQ TTL + Wait queue pattern)           │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │ 1. Handler throws any Error                                     │
 * │    ↓                                                            │
 * │ 2. Worker publishes to wait exchange                            |
 * |    (with header `x-wait-queue` set to the wait queue name)      │
 * │    ↓                                                            │
 * │ 3. Wait exchange routes to wait queue                           │
 * │    (with expiration: calculated backoff delay)                  │
 * │    ↓                                                            │
 * │ 4. Message waits in queue until TTL expires                     │
 * │    ↓                                                            │
 * │ 5. Expired message dead-lettered to retry exchange              |
 * |    (with header `x-retry-queue` set to the main queue name)     │
 * │    ↓                                                            │
 * │ 6. Retry exchange routes back to main queue → RETRY             │
 * │    ↓                                                            │
 * │ 7. If retries exhausted: nack without requeue → DLQ             │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */
function handleErrorTtlBackoff(
  ctx: RetryContext,
  error: Error,
  msg: ConsumeMessage,
  consumerName: string,
  consumer: ConsumerDefinition,
  config: ResolvedTtlBackoffRetryOptions,
): Future<Result<void, TechnicalError>> {
  if (!isQueueWithTtlBackoffInfrastructure(consumer.queue)) {
    ctx.logger?.error("Queue does not have TTL-backoff infrastructure", {
      consumerName,
      queueName: consumer.queue.name,
    });
    return Future.value(
      Result.Error(new TechnicalError("Queue does not have TTL-backoff infrastructure")),
    );
  }

  const queueEntry = consumer.queue;
  const queue = extractQueue(queueEntry);
  const queueName = queue.name;

  // Get retry count from headers
  const retryCount = (msg.properties.headers?.["x-retry-count"] as number) ?? 0;

  // Max retries exceeded -> DLQ
  if (retryCount >= config.maxRetries) {
    ctx.logger?.error("Max retries exceeded, sending to DLQ (ttl-backoff mode)", {
      consumerName,
      queueName,
      retryCount,
      maxRetries: config.maxRetries,
      error: error.message,
    });
    sendToDLQ(ctx, msg, consumer);
    return Future.value(Result.Ok(undefined));
  }

  // Retry with exponential backoff
  const delayMs = calculateRetryDelay(retryCount, config);
  ctx.logger?.warn("Retrying message (ttl-backoff mode)", {
    consumerName,
    queueName,
    retryCount: retryCount + 1,
    maxRetries: config.maxRetries,
    delayMs,
    error: error.message,
  });

  // Re-publish the message to the wait exchange with TTL and incremented x-retry-count header
  return publishForRetry(ctx, {
    msg,
    exchange: queueEntry.waitExchange.name,
    routingKey: msg.fields.routingKey, // Preserve original routing key
    waitQueueName: queueEntry.waitQueue.name,
    queueName,
    delayMs,
    error,
  });
}

/**
 * Calculate retry delay with exponential backoff and optional jitter.
 */
function calculateRetryDelay(retryCount: number, config: ResolvedTtlBackoffRetryOptions): number {
  const { initialDelayMs, maxDelayMs, backoffMultiplier, jitter } = config;

  let delay = Math.min(initialDelayMs * Math.pow(backoffMultiplier, retryCount), maxDelayMs);

  if (jitter) {
    // Add jitter: random value between 50% and 100% of calculated delay
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

/**
 * Parse message content for republishing.
 * Prevents double JSON serialization by converting Buffer to object when possible.
 */
function parseMessageContentForRetry(
  ctx: RetryContext,
  msg: ConsumeMessage,
  queueName: string,
): Buffer | unknown {
  let content: Buffer | unknown = msg.content;

  // If message is not compressed (no contentEncoding), parse it to get the original object
  if (!msg.properties.contentEncoding) {
    try {
      content = JSON.parse(msg.content.toString());
    } catch (err) {
      ctx.logger?.warn("Failed to parse message for retry, using original buffer", {
        queueName,
        error: err,
      });
    }
  }

  return content;
}

/**
 * Publish message with an incremented x-retry-count header and optional TTL.
 */
function publishForRetry(
  ctx: RetryContext,
  {
    msg,
    exchange,
    routingKey,
    queueName,
    waitQueueName,
    delayMs,
    error,
  }: {
    msg: ConsumeMessage;
    exchange: string;
    routingKey: string;
    queueName: string;
    waitQueueName?: string;
    delayMs?: number;
    error: Error;
  },
): Future<Result<void, TechnicalError>> {
  // Get retry count from headers
  const retryCount = (msg.properties.headers?.["x-retry-count"] as number) ?? 0;
  const newRetryCount = retryCount + 1;

  // Acknowledge original message
  ctx.amqpClient.ack(msg);

  const content = parseMessageContentForRetry(ctx, msg, queueName);

  // Publish message with incremented x-retry-count header and original error info
  return ctx.amqpClient
    .publish(exchange, routingKey, content, {
      ...msg.properties,
      ...(delayMs !== undefined ? { expiration: delayMs.toString() } : {}), // Per-message TTL
      headers: {
        ...msg.properties.headers,
        "x-retry-count": newRetryCount,
        "x-last-error": error.message,
        "x-first-failure-timestamp":
          msg.properties.headers?.["x-first-failure-timestamp"] ?? Date.now(),
        ...(waitQueueName !== undefined
          ? {
              "x-wait-queue": waitQueueName, // For wait exchange routing
              "x-retry-queue": queueName, // For retry exchange routing
            }
          : {}),
      },
    })
    .mapOkToResult((published) => {
      if (!published) {
        ctx.logger?.error("Failed to publish message for retry (write buffer full)", {
          queueName,
          retryCount: newRetryCount,
          ...(delayMs !== undefined ? { delayMs } : {}),
        });
        return Result.Error(
          new TechnicalError("Failed to publish message for retry (write buffer full)"),
        );
      }

      ctx.logger?.info("Message published for retry", {
        queueName,
        retryCount: newRetryCount,
        ...(delayMs !== undefined ? { delayMs } : {}),
      });
      return Result.Ok(undefined);
    });
}

/**
 * Send message to dead letter queue.
 * Nacks the message without requeue, relying on DLX configuration.
 */
function sendToDLQ(ctx: RetryContext, msg: ConsumeMessage, consumer: ConsumerDefinition): void {
  const queue = extractQueue(consumer.queue);
  const queueName = queue.name;
  const hasDeadLetter = queue.deadLetter !== undefined;

  if (!hasDeadLetter) {
    ctx.logger?.warn("Queue does not have DLX configured - message will be lost on nack", {
      queueName,
    });
  }

  ctx.logger?.info("Sending message to DLQ", {
    queueName,
    deliveryTag: msg.fields.deliveryTag,
  });

  // Nack without requeue - relies on DLX configuration
  ctx.amqpClient.nack(msg, false, false);
}
