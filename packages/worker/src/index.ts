export { TypedAmqpWorker } from "./worker.js";
export type { CreateWorkerOptions } from "./worker.js";
export type { HandlerError } from "./errors.js";
export {
  // Error classes
  MessageValidationError,
  NonRetryableError,
  RetryableError,
  // Type guards
  isHandlerError,
  isNonRetryableError,
  isRetryableError,
  // Factory functions
  nonRetryable,
  retryable,
} from "./errors.js";
export { defineHandler, defineHandlers } from "./handlers.js";
export type {
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlerEntry,
  WorkerInferConsumerHandlers,
  WorkerConsumedMessage,
  WorkerInferConsumedMessage,
  WorkerInferConsumerHeaders,
} from "./types.js";
