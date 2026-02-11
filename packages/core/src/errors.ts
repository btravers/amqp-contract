/**
 * Error for technical/runtime failures that cannot be prevented by TypeScript.
 *
 * This includes AMQP connection failures, channel issues, validation failures,
 * and other runtime errors. This error is shared across core, worker, and client packages.
 */
export class TechnicalError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TechnicalError";
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
 * Error thrown when message validation fails (payload or headers).
 *
 * Used by both the client (publish-time payload validation) and the worker
 * (consume-time payload and headers validation).
 *
 * @param source - The name of the publisher or consumer that triggered the validation
 * @param issues - The validation issues from the Standard Schema validation
 */
export class MessageValidationError extends Error {
  constructor(
    public readonly source: string,
    public readonly issues: unknown,
  ) {
    super(`Message validation failed for "${source}"`);
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
