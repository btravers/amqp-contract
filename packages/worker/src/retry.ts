import type { Message } from "amqplib";
import type { RetryPolicy } from "@amqp-contract/contract";

/**
 * Header key used to track attempt count in AMQP message headers.
 * @internal
 */
export const RETRY_COUNT_HEADER = "x-retry-count";

/**
 * Get the current attempt count from message headers.
 * @param msg - The AMQP message
 * @returns The current attempt count (0 for initial attempt)
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
 * Calculate the interval before the next retry using the backoff strategy.
 * @param attemptNumber - Current attempt index (0 for initial attempt, 1 for first retry, etc.)
 * @param policy - The retry policy configuration
 * @returns Interval in milliseconds
 * @internal
 */
export function calculateBackoffDelay(attemptNumber: number, policy: RetryPolicy): number {
  const backoff = policy.backoff;
  if (!backoff) {
    return 1_000; // Default 1 second
  }

  const type = backoff.type ?? "fixed";
  const initialInterval = backoff.initialInterval ?? 1_000;
  const maxInterval = backoff.maxInterval ?? 60_000;
  const coefficient = backoff.coefficient ?? 2;

  if (type === "fixed") {
    return initialInterval;
  }

  // Exponential backoff: initialInterval * (coefficient ^ attemptNumber)
  const exponentialInterval = initialInterval * Math.pow(coefficient, attemptNumber);
  return Math.min(exponentialInterval, maxInterval);
}

/**
 * Check if a message should be retried based on the retry policy.
 * @param msg - The AMQP message
 * @param policy - The retry policy configuration (optional)
 * @returns Object indicating if retry should happen and the interval
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
  const maxAttempts = policy.maxAttempts ?? Number.POSITIVE_INFINITY;

  // Check if performing the next attempt would exceed the attempt limit
  if (currentRetryCount + 1 >= maxAttempts) {
    return { shouldRetry: false, delay: 0, currentRetryCount };
  }

  // Calculate backoff interval for this retry attempt
  const delay = calculateBackoffDelay(currentRetryCount, policy);

  return { shouldRetry: true, delay, currentRetryCount };
}
