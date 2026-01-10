/**
 * Base error class for worker errors
 */
abstract class WorkerError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = "WorkerError";
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
 * Error for technical/runtime failures in worker operations
 * This includes validation failures, parsing failures, and processing failures
 */
export class TechnicalError extends WorkerError {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TechnicalError";
  }
}

/**
 * Error thrown when message validation fails
 */
export class MessageValidationError extends WorkerError {
  constructor(
    public readonly consumerName: string,
    public readonly issues: unknown,
  ) {
    super(`Message validation failed for consumer "${consumerName}"`);
    this.name = "MessageValidationError";
  }
}

/**
 * Retryable errors - transient failures that may succeed on retry
 * Examples: network timeouts, rate limiting, temporary service unavailability
 *
 * Use this error type when the operation might succeed if retried.
 * The worker will apply exponential backoff and retry the message.
 */
export class RetryableError extends WorkerError {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Non-retryable errors - permanent failures that should not be retried
 * Examples: invalid data, business rule violations, permanent external failures
 *
 * Use this error type when retrying would not help - the message will be
 * immediately sent to the dead letter queue (DLQ) if configured.
 */
export class NonRetryableError extends WorkerError {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}

/**
 * Union type representing all handler errors.
 * Use this type when defining handlers that explicitly signal error outcomes.
 */
export type HandlerError = RetryableError | NonRetryableError;
