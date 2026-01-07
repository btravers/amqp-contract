import {
  type ContractDefinition,
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { TypedAmqpWorker } from "../worker.js";
import type { WorkerInferConsumerHandlers } from "../types.js";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { z } from "zod";

const it = baseIt.extend<{
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

describe("AmqpWorker Retry Integration", () => {
  it("should retry failed messages up to maxAttempts limit", async ({
    workerFactory,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      shouldFail: z.boolean(),
    });

    const exchange = defineExchange("retry-test-exchange", "topic", { durable: false });
    const queue = defineQueue("retry-test-queue", { durable: false });

    const contract = defineContract({
      exchanges: { test: exchange },
      queues: { testQueue: queue },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage), {
          retryPolicy: {
            maxAttempts: 3,
            backoff: {
              type: "fixed",
              initialInterval: 100,
            },
          },
        }),
      },
    });

    let attemptCount = 0;
    const handler = vi.fn(async (msg: { id: string; shouldFail: boolean }) => {
      attemptCount++;
      if (msg.shouldFail) {
        throw new Error("Simulated failure");
      }
    });

    await workerFactory(contract, {
      testConsumer: handler,
    });

    // WHEN - Publish a message that will fail
    await publishMessage("retry-test-exchange", "test.message", {
      id: "test-1",
      shouldFail: true,
    });

    // Wait for retries to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // THEN - Handler should be called maxAttempts times (3 attempts total)
    expect(attemptCount).toBe(3);
  });

  it("should apply exponential backoff between retries", async ({
    workerFactory,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
    });

    const exchange = defineExchange("backoff-test-exchange", "topic", { durable: false });
    const queue = defineQueue("backoff-test-queue", { durable: false });

    const contract = defineContract({
      exchanges: { test: exchange },
      queues: { testQueue: queue },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage), {
          retryPolicy: {
            maxAttempts: 3,
            backoff: {
              type: "exponential",
              initialInterval: 100,
              coefficient: 2,
            },
          },
        }),
      },
    });

    const timestamps: number[] = [];
    const handler = vi.fn(async () => {
      timestamps.push(Date.now());
      throw new Error("Simulated failure");
    });

    await workerFactory(contract, {
      testConsumer: handler,
    });

    // WHEN
    await publishMessage("backoff-test-exchange", "test.message", {
      id: "test-1",
    });

    // Wait for all retries
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // THEN - Verify exponential backoff delays
    expect(timestamps.length).toBeGreaterThanOrEqual(3);
    const [ts0, ts1, ts2] = timestamps;
    if (ts0 !== undefined && ts1 !== undefined && ts2 !== undefined) {
      const delay1 = ts1 - ts0;
      const delay2 = ts2 - ts1;
      // Second delay should be roughly 2x the first delay (100ms vs 200ms)
      // Allow some margin for execution time
      expect(delay2).toBeGreaterThan(delay1 * 1.5);
    }
  });

  it("should not retry when maxAttempts is 0", async ({ workerFactory, publishMessage }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
    });

    const exchange = defineExchange("no-retry-exchange", "topic", { durable: false });
    const queue = defineQueue("no-retry-queue", { durable: false });

    const contract = defineContract({
      exchanges: { test: exchange },
      queues: { testQueue: queue },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage), {
          retryPolicy: {
            maxAttempts: 0, // Fail fast
          },
        }),
      },
    });

    let attemptCount = 0;
    const handler = vi.fn(async () => {
      attemptCount++;
      throw new Error("Simulated failure");
    });

    await workerFactory(contract, {
      testConsumer: handler,
    });

    // WHEN
    await publishMessage("no-retry-exchange", "test.message", {
      id: "test-1",
    });

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // THEN - Handler called once (initial attempt), no retries
    // Note: maxAttempts: 0 means "process once with no retries", not "never process"
    expect(attemptCount).toBe(1);
  });

  it("should send to DLX when maxAttempts exceeded", async ({ workerFactory, publishMessage }) => {
    // GIVEN - Create main queue with DLX configured
    const TestMessage = z.object({
      id: z.string(),
    });

    const mainExchange = defineExchange("main-exchange", "topic", { durable: false });
    const dlxExchange = defineExchange("dlx-exchange", "topic", { durable: false });
    const mainQueue = defineQueue("main-queue", {
      durable: false,
      deadLetter: {
        exchange: dlxExchange,
        routingKey: "failed",
      },
    });
    const dlxQueue = defineQueue("dlx-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        main: mainExchange,
        dlx: dlxExchange,
      },
      queues: {
        mainQueue,
        dlxQueue,
      },
      bindings: {
        mainBinding: defineQueueBinding(mainQueue, mainExchange, { routingKey: "test.#" }),
        dlxBinding: defineQueueBinding(dlxQueue, dlxExchange, { routingKey: "failed" }),
      },
      publishers: {
        mainPublisher: definePublisher(mainExchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        mainConsumer: defineConsumer(mainQueue, defineMessage(TestMessage), {
          retryPolicy: {
            maxAttempts: 2,
            backoff: {
              type: "fixed",
              initialInterval: 100,
            },
          },
        }),
        dlxConsumer: defineConsumer(dlxQueue, defineMessage(TestMessage)),
      },
    });

    let mainAttemptCount = 0;
    const dlxMessages: Array<{ id: string }> = [];

    await workerFactory(contract, {
      mainConsumer: async () => {
        mainAttemptCount++;
        throw new Error("Simulated failure");
      },
      dlxConsumer: async (msg) => {
        dlxMessages.push(msg);
      },
    });

    // WHEN
    await publishMessage("main-exchange", "test.message", {
      id: "test-dlx-1",
    });

    // Wait for retries and DLX routing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // THEN
    expect(mainAttemptCount).toBe(2); // 2 attempts total
    expect(dlxMessages).toHaveLength(1);
    expect(dlxMessages[0]).toEqual({ id: "test-dlx-1" });
  });

  it("should successfully process message after transient failure", async ({
    workerFactory,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    const exchange = defineExchange("transient-exchange", "topic", { durable: false });
    const queue = defineQueue("transient-queue", { durable: false });

    const contract = defineContract({
      exchanges: { test: exchange },
      queues: { testQueue: queue },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage), {
          retryPolicy: {
            maxAttempts: 3,
            backoff: {
              type: "fixed",
              initialInterval: 100,
            },
          },
        }),
      },
    });

    let attemptCount = 0;
    const successfulMessages: Array<{ id: string; value: number }> = [];
    const handler = vi.fn(async (msg: { id: string; value: number }) => {
      attemptCount++;
      // Fail first 2 attempts, succeed on 3rd
      if (attemptCount < 3) {
        throw new Error("Transient failure");
      }
      successfulMessages.push(msg);
    });

    await workerFactory(contract, {
      testConsumer: handler,
    });

    // WHEN
    await publishMessage("transient-exchange", "test.message", {
      id: "test-transient",
      value: 42,
    });

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // THEN - Message should eventually succeed
    expect(attemptCount).toBe(3);
    expect(successfulMessages).toHaveLength(1);
    expect(successfulMessages[0]).toEqual({ id: "test-transient", value: 42 });
  });
});
