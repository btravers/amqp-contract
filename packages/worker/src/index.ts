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
  // Handler types (current names)
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlerEntry,
  WorkerInferConsumerHandlers,
  // Handler types (deprecated aliases - for backwards compatibility)
  WorkerInferSafeConsumerHandler,
  WorkerInferSafeConsumerHandlerEntry,
  WorkerInferSafeConsumerHandlers,
  // Common types
  WorkerConsumedMessage,
  WorkerInferConsumedMessage,
  WorkerInferConsumerHeaders,
} from "./types.js";
