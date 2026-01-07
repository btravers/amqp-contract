import type { ContractDefinition } from "@amqp-contract/contract";
import { TypedAmqpWorker } from "../worker.js";
import type { WorkerInferConsumerHandlers } from "../types.js";
import { it as baseIt } from "@amqp-contract/testing/extension";

export const it = baseIt.extend<{
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferConsumerHandlers<TContract>,
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  workerFactory: async ({ amqpConnectionUrl }, use) => {
    const workers: Array<TypedAmqpWorker<ContractDefinition>> = [];

    try {
      await use(
        async <TContract extends ContractDefinition>(
          contract: TContract,
          handlers: WorkerInferConsumerHandlers<TContract>,
        ) => {
          const worker = await TypedAmqpWorker.create({
            contract,
            handlers,
            urls: [amqpConnectionUrl],
          }).resultToPromise();

          workers.push(worker);
          return worker;
        },
      );
    } finally {
      await Promise.all(
        workers.map(async (worker) => {
          try {
            await worker.close().resultToPromise();
          } catch (error) {
            // Swallow errors during cleanup
            console.error("Failed to close worker during fixture cleanup:", error);
          }
        }),
      );
    }
  },
});
