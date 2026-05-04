export { TypedAmqpWorker } from "./worker.js";
export type { CreateWorkerOptions, ConsumerOptions } from "./worker.js";
export {
  // Error classes (HandlerError is an abstract base class)
  HandlerError,
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
  WorkerConsumedMessage,
  WorkerInferConsumedMessage,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlerEntry,
  WorkerInferConsumerHeaders,
  WorkerInferHandlers,
  WorkerInferRpcConsumedMessage,
  WorkerInferRpcHandler,
  WorkerInferRpcHandlerEntry,
  WorkerInferRpcHeaders,
  WorkerInferRpcRequest,
  WorkerInferRpcResponse,
} from "./types.js";
