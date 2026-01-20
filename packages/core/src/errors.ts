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
