import type { Message } from "amqplib";
import type { RetryPolicy } from "@amqp-contract/contract";

/**
 * Header key used to track retry count in AMQP message headers.
 * @internal
 */
export const RETRY_COUNT_HEADER = "x-retry-count";

/**
 * Get the current retry count from message headers.
 * @param msg - The AMQP message
 * @returns The current retry count (0 if not set)
 * @internal
 */
export function getRetryCount(msg: Message): number {
  const retryCount = msg.properties.headers?.[RETRY_COUNT_HEADER];
  if (typeof retryCount === "number" && retryCount >= 0) {
    return retryCount;
  }
  return 0;
}

/**
 * Calculate the delay before the next retry using the backoff strategy.
 * @param retryCount - Current retry count (0-indexed)
 * @param policy - The retry policy configuration
 * @returns Delay in milliseconds
 * @internal
 */
export function calculateBackoffDelay(retryCount: number, policy: RetryPolicy): number {
  const backoff = policy.backoff;
  if (!backoff) {
    return 1000; // Default 1 second
  }

  const type = backoff.type ?? "fixed";
  const initialDelay = backoff.initialDelay ?? 1000;
  const maxDelay = backoff.maxDelay ?? 60000;
  const multiplier = backoff.multiplier ?? 2;

  if (type === "fixed") {
    return initialDelay;
  }

  // Exponential backoff: initialDelay * (multiplier ^ retryCount)
  const exponentialDelay = initialDelay * Math.pow(multiplier, retryCount);
  return Math.min(exponentialDelay, maxDelay);
}

/**
 * Check if a message should be retried based on the retry policy.
 * @param msg - The AMQP message
 * @param policy - The retry policy configuration (optional)
 * @returns Object indicating if retry should happen and the delay
 * @internal
 */
export function shouldRetry(
  msg: Message,
  policy: RetryPolicy | undefined,
): { shouldRetry: boolean; delay: number; currentRetryCount: number } {
  // If no policy is configured, use legacy behavior (infinite retries)
  if (!policy) {
    return { shouldRetry: true, delay: 0, currentRetryCount: 0 };
  }

  const currentRetryCount = getRetryCount(msg);
  const maxRetries = policy.maxRetries ?? Number.POSITIVE_INFINITY;

  // Check if we've exceeded the retry limit
  if (currentRetryCount >= maxRetries) {
    return { shouldRetry: false, delay: 0, currentRetryCount };
  }

  // Calculate backoff delay for this retry attempt
  const delay = calculateBackoffDelay(currentRetryCount, policy);

  return { shouldRetry: true, delay, currentRetryCount };
}
