import type { ContractDefinition } from "@amqp-contract/contract";
import { TypedAmqpWorker } from "../worker.js";
import type { WorkerInferSafeConsumerHandlers } from "../types.js";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { setupAmqpTopology } from "@amqp-contract/core";

export const it = baseIt.extend<{
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferSafeConsumerHandlers<TContract>,
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  workerFactory: async ({ amqpConnectionUrl, amqpChannel }, use) => {
    const workers: Array<TypedAmqpWorker<ContractDefinition>> = [];

    try {
      await use(
        async <TContract extends ContractDefinition>(
          contract: TContract,
          handlers: WorkerInferSafeConsumerHandlers<TContract>,
        ) => {
          // Set up topology (exchanges, queues, bindings, wait queues) before creating worker
          await setupAmqpTopology(amqpChannel, contract);

          const worker = await TypedAmqpWorker.create({
            contract,
            handlers,
            urls: [amqpConnectionUrl],
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
