import { CreateWorkerOptions, TypedAmqpWorker } from "../worker.js";
import { ContractDefinition } from "@amqp-contract/contract";
import { WorkerInferSafeConsumerHandlers } from "../types.js";
import { it as baseIt } from "@amqp-contract/testing/extension";

export const it = baseIt.extend<{
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferSafeConsumerHandlers<TContract>,
    retryOptions?: CreateWorkerOptions<TContract>["retry"],
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  workerFactory: async ({ amqpConnectionUrl }, use) => {
    const workers: Array<TypedAmqpWorker<ContractDefinition>> = [];

    try {
      await use(
        async <TContract extends ContractDefinition>(
          contract: TContract,
          handlers: WorkerInferSafeConsumerHandlers<TContract>,
          retryOptions?: CreateWorkerOptions<TContract>["retry"],
        ) => {
          const worker = await TypedAmqpWorker.create({
            contract,
            handlers,
            urls: [amqpConnectionUrl],
            retry: retryOptions,
            logger: console,
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
