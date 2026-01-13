export { TypedAmqpWorker } from "./worker.js";
export type { CreateWorkerOptions } from "./worker.js";
export type { HandlerError } from "./errors.js";
export {
  MessageValidationError,
  NonRetryableError,
  RetryableError,
  TechnicalError,
} from "./errors.js";
export {
  defineHandler,
  defineHandlers,
  defineUnsafeHandler,
  defineUnsafeHandlers,
} from "./handlers.js";
export type {
  // Retry configuration types (discriminated union)
  QuorumNativeRetryOptions,
  RetryMode,
  RetryOptions,
  TtlBackoffRetryOptions,
  // Safe handler types (recommended)
  WorkerInferSafeConsumerBatchHandler,
  WorkerInferSafeConsumerHandler,
  WorkerInferSafeConsumerHandlerEntry,
  WorkerInferSafeConsumerHandlers,
  // Unsafe handler types (legacy)
  WorkerInferUnsafeConsumerBatchHandler,
  WorkerInferUnsafeConsumerHandler,
  WorkerInferUnsafeConsumerHandlerEntry,
  WorkerInferUnsafeConsumerHandlers,
  // Legacy aliases (deprecated)
  WorkerInferConsumerBatchHandler,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlerEntry,
  WorkerInferConsumerHandlers,
  // Common types
  WorkerInferConsumerInput,
} from "./types.js";
