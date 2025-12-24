export { AmqpWorkerModule, type AmqpWorkerModuleAsyncOptions } from "./worker.module.js";
export { MODULE_OPTIONS_TOKEN } from "./worker.module-definition.js";
export { AmqpWorkerService } from "./worker.service.js";
export type { AmqpWorkerModuleOptions } from "./worker.service.js";
export type {
  WorkerInferConsumerInput,
  WorkerInferConsumerHandler,
  WorkerInferConsumerHandlers,
} from "@amqp-contract/worker";
export { defineHandler, defineHandlers } from "@amqp-contract/worker";
