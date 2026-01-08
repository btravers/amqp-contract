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
 * Base class for retryable errors - these are transient failures that may succeed on retry.
 * Examples: network timeouts, temporary service unavailability, rate limiting
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
 * Base class for non-retryable errors - these are permanent failures that will never succeed.
 * Examples: validation errors, business logic violations, missing resources
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
