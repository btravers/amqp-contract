/* oxlint-disable eslint/sort-imports */
import {
  ContractDefinition,
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

const it = baseIt.extend<{
  workerFactory: <TContract extends ContractDefinition>(
    contract: TContract,
    handlers: WorkerInferConsumerHandlers<TContract>,
  ) => Promise<TypedAmqpWorker<TContract>>;
}>({
  workerFactory: async ({ amqpConnectionUrl }, use) => {
    const workers: TypedAmqpWorker<ContractDefinition>[] = [];
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
    await Promise.all(workers.map((worker) => worker.close().resultToPromise()));
  },
});

describe("AmqpWorker Prefetch and Batch Integration", () => {
  it("should apply prefetch configuration to consumer", async ({
    workerFactory,
    publishMessage,
  }) => {
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
    await workerFactory(contract, {
      testConsumer: [
        async (msg: { id: string; message: string }) => {
          messages.push(msg);
          // Simulate slow processing to test prefetch
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        { prefetch: 5 },
      ],
    });

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
    await workerFactory(contract, {
      // Use tuple format with batch options
      batchConsumer: [
        async (messages: Array<{ id: string; value: number }>) => {
          batches.push(messages);
        },
        {
          batchSize: 3,
          batchTimeout: 2000,
        },
      ],
    });

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

    expect(batches).toEqual([
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
      expect.arrayContaining([expect.anything(), expect.anything(), expect.anything()]),
      expect.arrayContaining([expect.anything()]),
    ]);

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
    await workerFactory(contract, {
      batchConsumer: [
        async (messages: Array<{ id: string; text: string }>) => {
          batches.push(messages);
        },
        {
          batchSize: 5,
          batchTimeout: 500, // 500ms timeout
        },
      ],
    });

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

    expect(batches).toEqual([
      expect.arrayContaining([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "2" }),
      ]),
    ]);
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
    await workerFactory(contract, {
      combinedConsumer: [
        async (messages: Array<{ id: string }>) => {
          batches.push(messages);
          // Simulate processing time
          await new Promise((resolve) => setTimeout(resolve, 50));
        },
        {
          prefetch: 10,
          batchSize: 4,
          batchTimeout: 1000,
        },
      ],
    });

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

    expect(batches).toEqual([
      expect.arrayContaining([
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      ]),
      expect.arrayContaining([
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      ]),
      expect.arrayContaining([
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      ]),
    ]);
  });

  describe("Validation Error Handling", () => {
    it("should reject worker creation with invalid prefetch (zero)", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });
      const exchange = defineExchange("validation-test-exchange", "topic", { durable: false });
      const queue = defineQueue("validation-test-queue", { durable: false });

      const contract = defineContract({
        exchanges: { test: exchange },
        queues: { testQueue: queue },
        bindings: {
          testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      // WHEN
      const result = await TypedAmqpWorker.create({
        contract,
        handlers: {
          testConsumer: [async () => {}, { prefetch: 0 }],
        },
        urls: [amqpConnectionUrl],
      }).toPromise();

      // THEN
      expect(result.isError()).toBe(true);
      if (result.isError()) {
        expect(result.error.message).toContain("Invalid prefetch value");
        expect(result.error.message).toContain("must be a positive integer");
      }
    });

    it("should reject worker creation with invalid prefetch (negative)", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });
      const exchange = defineExchange("validation-test-exchange", "topic", { durable: false });
      const queue = defineQueue("validation-test-queue", { durable: false });

      const contract = defineContract({
        exchanges: { test: exchange },
        queues: { testQueue: queue },
        bindings: {
          testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      // WHEN
      const result = await TypedAmqpWorker.create({
        contract,
        handlers: {
          testConsumer: [async () => {}, { prefetch: -5 }],
        },
        urls: [amqpConnectionUrl],
      }).toPromise();

      // THEN
      expect(result.isError()).toBe(true);
      if (result.isError()) {
        expect(result.error.message).toContain("Invalid prefetch value");
      }
    });

    it("should reject worker creation with invalid batchSize (zero)", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });
      const exchange = defineExchange("validation-test-exchange", "topic", { durable: false });
      const queue = defineQueue("validation-test-queue", { durable: false });

      const contract = defineContract({
        exchanges: { test: exchange },
        queues: { testQueue: queue },
        bindings: {
          testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      // WHEN
      const result = await TypedAmqpWorker.create({
        contract,
        handlers: {
          testConsumer: [async () => {}, { batchSize: 0 }],
        },
        urls: [amqpConnectionUrl],
      }).toPromise();

      // THEN
      expect(result.isError()).toBe(true);
      if (result.isError()) {
        expect(result.error.message).toContain("Invalid batchSize");
        expect(result.error.message).toContain("must be a positive integer");
      }
    });

    it("should reject worker creation with invalid batchTimeout (negative)", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });
      const exchange = defineExchange("validation-test-exchange", "topic", { durable: false });
      const queue = defineQueue("validation-test-queue", { durable: false });

      const contract = defineContract({
        exchanges: { test: exchange },
        queues: { testQueue: queue },
        bindings: {
          testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      // WHEN
      const result = await TypedAmqpWorker.create({
        contract,
        handlers: {
          testConsumer: [async () => {}, { batchSize: 5, batchTimeout: -100 }],
        },
        urls: [amqpConnectionUrl],
      }).toPromise();

      // THEN
      expect(result.isError()).toBe(true);
      if (result.isError()) {
        expect(result.error.message).toContain("Invalid batchTimeout");
        expect(result.error.message).toContain("must be a positive number");
      }
    });

    it("should reject worker creation with invalid batchTimeout (zero)", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });
      const exchange = defineExchange("validation-test-exchange", "topic", { durable: false });
      const queue = defineQueue("validation-test-queue", { durable: false });

      const contract = defineContract({
        exchanges: { test: exchange },
        queues: { testQueue: queue },
        bindings: {
          testBinding: defineQueueBinding(queue, exchange, { routingKey: "test.#" }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      // WHEN
      const result = await TypedAmqpWorker.create({
        contract,
        handlers: {
          testConsumer: [async () => {}, { batchSize: 5, batchTimeout: 0 }],
        },
        urls: [amqpConnectionUrl],
      }).toPromise();

      // THEN
      expect(result.isError()).toBe(true);
      if (result.isError()) {
        expect(result.error.message).toContain("Invalid batchTimeout");
      }
    });
  });
});
