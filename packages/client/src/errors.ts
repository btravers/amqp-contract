/**
 * Error thrown when message validation fails
 */
export class MessageValidationError extends Error {
  constructor(
    public readonly publisherName: string,
    public readonly issues: unknown,
  ) {
    super(`Message validation failed for publisher "${publisherName}"`);
    this.name = "MessageValidationError";
    // Node.js specific stack trace capture
    const ErrorConstructor = Error as unknown as {
      captureStackTrace?: (target: object, constructor: Function) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === "function") {
      ErrorConstructor.captureStackTrace(this, this.constructor);
    }
  }
}
