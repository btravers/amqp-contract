export { MessageValidationError } from "@amqp-contract/core";

/**
 * Captured `Error.captureStackTrace` shim — only present on Node.js.
 */
function captureStack(target: object, ctor: Function): void {
  const ErrorConstructor = Error as unknown as {
    captureStackTrace?: (target: object, constructor: Function) => void;
  };
  if (typeof ErrorConstructor.captureStackTrace === "function") {
    ErrorConstructor.captureStackTrace(target, ctor);
  }
}

/**
 * Returned from `TypedAmqpClient.call()` when the configured `timeoutMs` elapses
 * before the RPC server publishes a reply with the matching `correlationId`.
 *
 * The pending call is removed from the in-memory correlation map; if a reply
 * arrives after the timeout it is dropped (and a debug log is emitted by the
 * client if a logger is configured).
 */
export class RpcTimeoutError extends Error {
  constructor(
    public readonly publisherName: string,
    public readonly timeoutMs: number,
  ) {
    super(`RPC call to "${publisherName}" timed out after ${timeoutMs}ms with no reply received`);
    this.name = "RpcTimeoutError";
    captureStack(this, this.constructor);
  }
}

/**
 * Returned from any in-flight RPC call when the client is closed before the
 * reply is received. The correlation map is cleared on close and every pending
 * caller's promise resolves with `Result.Error(RpcCancelledError)`.
 */
export class RpcCancelledError extends Error {
  constructor(public readonly publisherName: string) {
    super(`RPC call to "${publisherName}" was cancelled because the client was closed`);
    this.name = "RpcCancelledError";
    captureStack(this, this.constructor);
  }
}
