/**
 * Base error class for client errors
 */
abstract class ClientError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = "ClientError";
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
 * Error for technical/runtime failures that cannot be prevented by TypeScript
 * This includes validation failures and AMQP channel issues
 */
export class TechnicalError extends ClientError {
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
export class MessageValidationError extends ClientError {
  constructor(
    public readonly publisherName: string,
    public readonly issues: unknown,
  ) {
    super(`Message validation failed for publisher "${publisherName}"`);
    this.name = "MessageValidationError";
  }
}
