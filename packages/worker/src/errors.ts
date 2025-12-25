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
 * Base error class for handler errors.
 * Extend this class to create custom error types for your handlers.
 */
export abstract class HandlerError extends Error {
  /**
   * Indicates whether this error is retryable.
   * - true: Error is transient and message should be retried with exponential backoff
   * - false: Error is permanent and message should be sent to dead letter queue
   */
  abstract readonly retryable: boolean;

  protected constructor(message: string) {
    super(message);
    this.name = "HandlerError";
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
 * Error for retryable failures in message processing.
 * These errors represent transient issues (e.g., network timeouts, rate limits)
 * that may succeed if retried later with exponential backoff.
 *
 * @example
 * ```typescript
 * async function processOrder(message: OrderMessage) {
 *   try {
 *     await externalApi.createOrder(message);
 *   } catch (error) {
 *     if (error.code === 'RATE_LIMITED') {
 *       throw new RetryableError('Rate limited by external API', error);
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
export class RetryableError extends HandlerError {
  readonly retryable = true;

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

/**
 * Error for non-retryable failures in message processing.
 * These errors represent permanent issues (e.g., invalid data, business rule violations)
 * that will not succeed even if retried. Messages causing these errors should be
 * sent to the dead letter queue.
 *
 * @example
 * ```typescript
 * async function processOrder(message: OrderMessage) {
 *   const user = await db.findUser(message.userId);
 *   if (!user) {
 *     throw new NonRetryableError(`User ${message.userId} not found`);
 *   }
 *   // ... process order
 * }
 * ```
 */
export class NonRetryableError extends HandlerError {
  readonly retryable = false;

  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NonRetryableError";
  }
}
