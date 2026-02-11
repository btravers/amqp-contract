export { MessageValidationError } from "@amqp-contract/core";

/**
 * Retryable errors - transient failures that may succeed on retry
 * Examples: network timeouts, rate limiting, temporary service unavailability
 *
 * Use this error type when the operation might succeed if retried.
 * The worker will apply exponential backoff and retry the message.
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RetryableError";
    // Node.js specific stack trace capture
    const ErrorConstructor = Error as unknown as {
      captureStackTrace?: (target: object, constructor: Function) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === "function") {
      ErrorConstructor.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Non-retryable errors - permanent failures that should not be retried
 * Examples: invalid data, business rule violations, permanent external failures
 *
 * Use this error type when retrying would not help - the message will be
 * immediately sent to the dead letter queue (DLQ) if configured.
 */
export class NonRetryableError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NonRetryableError";
    // Node.js specific stack trace capture
    const ErrorConstructor = Error as unknown as {
      captureStackTrace?: (target: object, constructor: Function) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === "function") {
      ErrorConstructor.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Union type representing all handler errors.
 * Use this type when defining handlers that explicitly signal error outcomes.
 */
export type HandlerError = RetryableError | NonRetryableError;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a RetryableError.
 *
 * Use this to check error types in catch blocks or error handlers.
 *
 * @param error - The error to check
 * @returns True if the error is a RetryableError
 *
 * @example
 * ```typescript
 * import { isRetryableError } from '@amqp-contract/worker';
 *
 * try {
 *   await processMessage();
 * } catch (error) {
 *   if (isRetryableError(error)) {
 *     console.log('Will retry:', error.message);
 *   } else {
 *     console.log('Permanent failure:', error);
 *   }
 * }
 * ```
 */
export function isRetryableError(error: unknown): error is RetryableError {
  return error instanceof RetryableError;
}

/**
 * Type guard to check if an error is a NonRetryableError.
 *
 * Use this to check error types in catch blocks or error handlers.
 *
 * @param error - The error to check
 * @returns True if the error is a NonRetryableError
 *
 * @example
 * ```typescript
 * import { isNonRetryableError } from '@amqp-contract/worker';
 *
 * try {
 *   await processMessage();
 * } catch (error) {
 *   if (isNonRetryableError(error)) {
 *     console.log('Will not retry:', error.message);
 *   }
 * }
 * ```
 */
export function isNonRetryableError(error: unknown): error is NonRetryableError {
  return error instanceof NonRetryableError;
}

/**
 * Type guard to check if an error is any HandlerError (RetryableError or NonRetryableError).
 *
 * @param error - The error to check
 * @returns True if the error is a HandlerError
 *
 * @example
 * ```typescript
 * import { isHandlerError } from '@amqp-contract/worker';
 *
 * function handleError(error: unknown) {
 *   if (isHandlerError(error)) {
 *     // error is RetryableError | NonRetryableError
 *     console.log('Handler error:', error.name, error.message);
 *   }
 * }
 * ```
 */
export function isHandlerError(error: unknown): error is HandlerError {
  return isRetryableError(error) || isNonRetryableError(error);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a RetryableError with less verbosity.
 *
 * This is a shorthand factory function for creating RetryableError instances.
 * Use it for cleaner error creation in handlers.
 *
 * @param message - Error message describing the failure
 * @param cause - Optional underlying error that caused this failure
 * @returns A new RetryableError instance
 *
 * @example
 * ```typescript
 * import { retryable } from '@amqp-contract/worker';
 * import { Future, Result } from '@swan-io/boxed';
 *
 * const handler = ({ payload }) =>
 *   Future.fromPromise(processPayment(payload))
 *     .mapOk(() => undefined)
 *     .mapError((e) => retryable('Payment service unavailable', e));
 *
 * // Equivalent to:
 * // .mapError((e) => new RetryableError('Payment service unavailable', e));
 * ```
 */
export function retryable(message: string, cause?: unknown): RetryableError {
  return new RetryableError(message, cause);
}

/**
 * Create a NonRetryableError with less verbosity.
 *
 * This is a shorthand factory function for creating NonRetryableError instances.
 * Use it for cleaner error creation in handlers.
 *
 * @param message - Error message describing the failure
 * @param cause - Optional underlying error that caused this failure
 * @returns A new NonRetryableError instance
 *
 * @example
 * ```typescript
 * import { nonRetryable } from '@amqp-contract/worker';
 * import { Future, Result } from '@swan-io/boxed';
 *
 * const handler = ({ payload }) => {
 *   if (!isValidPayload(payload)) {
 *     return Future.value(Result.Error(nonRetryable('Invalid payload format')));
 *   }
 *   return Future.value(Result.Ok(undefined));
 * };
 *
 * // Equivalent to:
 * // return Future.value(Result.Error(new NonRetryableError('Invalid payload format')));
 * ```
 */
export function nonRetryable(message: string, cause?: unknown): NonRetryableError {
  return new NonRetryableError(message, cause);
}
