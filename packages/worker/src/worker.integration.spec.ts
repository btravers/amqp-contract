import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect } from "vitest";
import { TypedAmqpClient } from "@amqp-contract/client";
import { TypedAmqpWorker } from "./worker.js";
import { it } from "@amqp-contract/testing/extension";
import { z } from "zod";

describe("AmqpWorker Integration", () => {
  it("should consume messages from a real RabbitMQ instance", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      message: z.string(),
    });

    const exchange = defineExchange("worker-test-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-test-queue", { durable: false });

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
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: (msg) => {
          messages.push(msg);
          return Promise.resolve();
        },
      },
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    // WHEN - Publish a message using the client
    const clientResult = await TypedAmqpClient.create({
      contract,
      urls: [amqpConnectionUrl],
    });

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;
    const publishResult = await client.publish("testPublisher", {
      id: "123",
      message: "Hello from integration test!",
    });

    expect(publishResult.isOk()).toBe(true);

    // THEN - Wait for message to be consumed
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      id: "123",
      message: "Hello from integration test!",
    });

    // CLEANUP
    await worker.close();
    await client.close();
  });

  it("should handle multiple messages", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      count: z.number(),
    });

    const exchange = defineExchange("worker-multi-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-multi-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "multi.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "multi.test",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const messages: Array<{ id: string; count: number }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: (msg) => {
          messages.push(msg);
          return Promise.resolve();
        },
      },
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    // WHEN - Publish multiple messages
    const clientResult = await TypedAmqpClient.create({
      contract,
      urls: [amqpConnectionUrl],
    });

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

    const result1 = await client.publish("testPublisher", { id: "1", count: 1 });
    const result2 = await client.publish("testPublisher", { id: "2", count: 2 });
    const result3 = await client.publish("testPublisher", { id: "3", count: 3 });

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);
    expect(result3.isOk()).toBe(true);

    // THEN - Wait for all messages to be consumed
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(messages).toHaveLength(3);
    expect(messages).toEqual([
      { id: "1", count: 1 },
      { id: "2", count: 2 },
      { id: "3", count: 3 },
    ]);

    // CLEANUP
    await worker.close();
    await client.close();
  });

  it("should consume all consumers with consumeAll", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const TestMessage = z.object({ id: z.string() });

    const exchange = defineExchange("worker-all-exchange", "topic", { durable: false });
    const queue1 = defineQueue("worker-all-queue1", { durable: false });
    const queue2 = defineQueue("worker-all-queue2", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        queue1,
        queue2,
      },
      bindings: {
        binding1: defineQueueBinding(queue1, exchange, {
          routingKey: "all.one",
        }),
        binding2: defineQueueBinding(queue2, exchange, {
          routingKey: "all.two",
        }),
      },
      publishers: {
        pub1: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "all.one",
        }),
        pub2: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "all.two",
        }),
      },
      consumers: {
        consumer1: defineConsumer(queue1, defineMessage(TestMessage)),
        consumer2: defineConsumer(queue2, defineMessage(TestMessage)),
      },
    });

    const messages1: Array<{ id: string }> = [];
    const messages2: Array<{ id: string }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        consumer1: (msg) => {
          messages1.push(msg);
          return Promise.resolve();
        },
        consumer2: (msg) => {
          messages2.push(msg);
          return Promise.resolve();
        },
      },
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    // WHEN - Publish messages to both queues
    const clientResult = await TypedAmqpClient.create({
      contract,
      urls: [amqpConnectionUrl],
    });

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

    const result1 = await client.publish("pub1", { id: "msg1" });
    const result2 = await client.publish("pub2", { id: "msg2" });

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    // THEN - Wait for messages to be consumed
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages1).toEqual([{ id: "msg1" }]);
    expect(messages2).toEqual([{ id: "msg2" }]);

    // CLEANUP
    await worker.close();
    await client.close();
  });
});
