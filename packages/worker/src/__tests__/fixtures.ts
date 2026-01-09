import { type RetryOptions, TypedAmqpWorker } from "../worker.js";
import type { ContractDefinition } from "@amqp-contract/contract";
import type { WorkerInferConsumerHandlers } from "../types.js";
import { it as baseIt } from "@amqp-contract/testing/extension";

/**
 * Shared test fixture for worker integration tests.
 * Provides a workerFactory that automatically manages worker lifecycle.
 */
export const it = baseIt.extend<{
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferConsumerHandlers<TContract>,
    retryOptions?: RetryOptions,
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  workerFactory: async ({ amqpConnectionUrl }, use) => {
    const workers: Array<TypedAmqpWorker<ContractDefinition>> = [];

    try {
      await use(
        async <TContract extends ContractDefinition>(
          contract: TContract,
          handlers: WorkerInferConsumerHandlers<TContract>,
          retryOptions?: RetryOptions,
        ) => {
          const worker = await TypedAmqpWorker.create({
            contract,
            handlers,
            urls: [amqpConnectionUrl],
            retry: retryOptions,
            logger: {
              debug: (message, context) => {
                console.debug(message, context);
              },

              info: (message, context) => {
                console.info(message, context);
              },

              warn: (message, context) => {
                console.warn(message, context);
              },

              error: (message, context) => {
                console.error(message, context);
              },
            },
          }).resultToPromise();

          workers.push(worker);
          return worker;
        },
      );
    } finally {
      // Clean up all workers before fixture cleanup (which deletes the vhost)
      await Promise.all(
        workers.map(async (worker) => {
          try {
            await worker.close().resultToPromise();
          } catch (error) {
            // Swallow errors during cleanup to avoid unhandled rejections
            // eslint-disable-next-line no-console
            console.error("Failed to close worker during fixture cleanup:", error);
          }
        }),
      );
    }
  },
});
