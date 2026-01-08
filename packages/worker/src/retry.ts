import type { Message } from "amqplib";
import type { RetryPolicy } from "./types.js";

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
 * Check if an error is non-retryable based on the retry policy.
 * @param error - The error that was thrown
 * @param policy - The retry policy configuration (optional)
 * @returns True if the error should not be retried
 * @internal
 */
export function isNonRetryableError(error: unknown, policy: RetryPolicy | undefined): boolean {
  if (!policy?.nonRetryableErrors || policy.nonRetryableErrors.length === 0) {
    return false;
  }

  const errorName = error instanceof Error ? error.constructor.name : "";
  const errorMessage = error instanceof Error ? error.message : String(error);

  return policy.nonRetryableErrors.some((pattern) => {
    // Match against error constructor name
    if (errorName === pattern) {
      return true;
    }
    // Match against error message (case-insensitive substring)
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return true;
    }
    return false;
  });
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
  const currentRetryCount = getRetryCount(msg);
  // Default to 1 attempt (no retries) if no policy or maxAttempts specified
  const maxAttempts = policy?.maxAttempts ?? 1;

  // Check if performing the next attempt would exceed the attempt limit
  if (currentRetryCount + 1 >= maxAttempts) {
    return { shouldRetry: false, delay: 0, currentRetryCount };
  }

  // Calculate backoff interval for this retry attempt
  const delay = policy ? calculateBackoffDelay(currentRetryCount, policy) : 0;

  return { shouldRetry: true, delay, currentRetryCount };
}
