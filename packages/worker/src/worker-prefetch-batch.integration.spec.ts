/* oxlint-disable eslint/sort-imports */
import {
  ContractDefinition,
  InferConsumerNames,
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { TypedAmqpWorker } from "./worker.js";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { z } from "zod";
import type { WorkerInferConsumerHandlers } from "./types.js";
import type { ConsumerOptions } from "./worker.js";

const it = baseIt.extend<{
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferConsumerHandlers<TContract>,
    consumerOptions?: Partial<Record<InferConsumerNames<TContract>, ConsumerOptions>>,
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  workerFactory: async ({ amqpConnectionUrl }, use) => {
    const workers: TypedAmqpWorker<ContractDefinition>[] = [];
    await use(
      async <TContract extends ContractDefinition>(
        contract: TContract,
        handlers: WorkerInferConsumerHandlers<TContract>,
        consumerOptions?: Partial<Record<InferConsumerNames<TContract>, ConsumerOptions>>,
      ) => {
        const worker = await TypedAmqpWorker.create({
          contract,
          handlers,
          urls: [amqpConnectionUrl],
          consumerOptions,
        }).resultToPromise();
        workers.push(worker);
        return worker;
      },
    );
    await Promise.all(workers.map((worker) => worker.close().resultToPromise()));
  },
});

describe("AmqpWorker Prefetch and Batch Integration", () => {
  it("should apply prefetch configuration to consumer", async ({ workerFactory, publishMessage }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      message: z.string(),
    });

    const exchange = defineExchange("prefetch-test-exchange", "topic", { durable: false });
    const queue = defineQueue("prefetch-test-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const messages: Array<{ id: string; message: string }> = [];
    await workerFactory(
      contract,
      {
        testConsumer: async (msg) => {
          messages.push(msg);
          // Simulate slow processing to test prefetch
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
      },
      {
        testConsumer: {
          prefetch: 5,
        },
      },
    );

    // WHEN - Publish multiple messages
    for (let i = 0; i < 10; i++) {
      publishMessage(exchange.name, "test.message", {
        id: `${i}`,
        message: `Test message ${i}`,
      });
    }

    // THEN - All messages should be consumed
    await vi.waitFor(
      () => {
        if (messages.length < 10) {
          throw new Error(`Only ${messages.length} messages consumed, expected 10`);
        }
      },
      { timeout: 5000 },
    );

    expect(messages).toHaveLength(10);
  });

  it("should process messages in batches when batchSize is configured", async ({
    workerFactory,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    const exchange = defineExchange("batch-test-exchange", "topic", { durable: false });
    const queue = defineQueue("batch-test-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.batch",
        }),
      },
      consumers: {
        batchConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const batches: Array<Array<{ id: string; value: number }>> = [];
    await workerFactory(
      contract,
      {
        // TypeScript should accept batch handler
        batchConsumer: async (messages) => {
          batches.push(messages);
        },
      },
      {
        batchConsumer: {
          batchSize: 3,
          batchTimeout: 2000,
        },
      },
    );

    // WHEN - Publish 7 messages (should result in 2 full batches of 3 and 1 partial batch of 1)
    for (let i = 0; i < 7; i++) {
      publishMessage(exchange.name, "test.batch", {
        id: `msg-${i}`,
        value: i,
      });
    }

    // THEN - Should receive 3 batches
    await vi.waitFor(
      () => {
        if (batches.length < 3) {
          throw new Error(`Only ${batches.length} batches received, expected 3`);
        }
      },
      { timeout: 5000 },
    );

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(3);
    expect(batches[1]).toHaveLength(3);
    expect(batches[2]).toHaveLength(1);

    // Verify message content
    const allMessages = batches.flat();
    expect(allMessages).toHaveLength(7);
    expect(allMessages.map((m) => m.id)).toEqual([
      "msg-0",
      "msg-1",
      "msg-2",
      "msg-3",
      "msg-4",
      "msg-5",
      "msg-6",
    ]);
  });

  it("should process partial batch after timeout", async ({ workerFactory, publishMessage }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      text: z.string(),
    });

    const exchange = defineExchange("batch-timeout-test-exchange", "topic", { durable: false });
    const queue = defineQueue("batch-timeout-test-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.timeout",
        }),
      },
      consumers: {
        batchConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const batches: Array<Array<{ id: string; text: string }>> = [];
    await workerFactory(
      contract,
      {
        batchConsumer: async (messages) => {
          batches.push(messages);
        },
      },
      {
        batchConsumer: {
          batchSize: 5,
          batchTimeout: 500, // 500ms timeout
        },
      },
    );

    // WHEN - Publish only 2 messages (less than batch size)
    publishMessage(exchange.name, "test.timeout", {
      id: "1",
      text: "First message",
    });
    publishMessage(exchange.name, "test.timeout", {
      id: "2",
      text: "Second message",
    });

    // THEN - Should receive 1 batch with 2 messages after timeout
    await vi.waitFor(
      () => {
        if (batches.length < 1) {
          throw new Error("No batches received yet");
        }
      },
      { timeout: 2000 },
    );

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0].map((m) => m.id)).toEqual(["1", "2"]);
  });

  it("should combine prefetch and batch configuration", async ({
    workerFactory,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
    });

    const exchange = defineExchange("combined-test-exchange", "topic", { durable: false });
    const queue = defineQueue("combined-test-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.combined",
        }),
      },
      consumers: {
        combinedConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const batches: Array<Array<{ id: string }>> = [];
    await workerFactory(
      contract,
      {
        combinedConsumer: async (messages) => {
          batches.push(messages);
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
      },
      {
        combinedConsumer: {
          prefetch: 10,
          batchSize: 4,
          batchTimeout: 1000,
        },
      },
    );

    // WHEN - Publish 12 messages
    for (let i = 0; i < 12; i++) {
      publishMessage(exchange.name, "test.combined", {
        id: `msg-${i}`,
      });
    }

    // THEN - Should receive 3 batches of 4
    await vi.waitFor(
      () => {
        if (batches.length < 3) {
          throw new Error(`Only ${batches.length} batches received, expected 3`);
        }
      },
      { timeout: 5000 },
    );

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(4);
    expect(batches[1]).toHaveLength(4);
    expect(batches[2]).toHaveLength(4);
  });
});
