import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { TypedAmqpWorker } from "./worker.js";
import { TypedAmqpClient } from "@amqp-contract/client";
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  definePublisher,
  defineConsumer,
  defineMessage,
} from "@amqp-contract/contract";
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
    const workerResult = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: (msg) => {
          messages.push(msg);
          return Promise.resolve();
        },
      },
      connection: amqpConnectionUrl,
    }).toPromise();
    if (workerResult.isError()) {
      throw workerResult.getError();
    }
    const worker = workerResult.value;

    // WHEN - Publish a message using the client
    const clientResult = await TypedAmqpClient.create({ contract, connection: amqpConnectionUrl }).toPromise();
    if (clientResult.isError()) {
      throw clientResult.getError();
    }
    const client = clientResult.value;
    const publishResult = await client
      .publish("testPublisher", {
        id: "123",
        message: "Hello from integration test!",
      })
      .toPromise();

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
    await client.close().toPromise();
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
    const workerResult = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: (msg) => {
          messages.push(msg);
          return Promise.resolve();
        },
      },
      connection: amqpConnectionUrl,
    }).toPromise();
    if (workerResult.isError()) {
      throw workerResult.getError();
    }
    const worker = workerResult.value;

    // WHEN - Publish multiple messages
    const clientResult = await TypedAmqpClient.create({ contract, connection: amqpConnectionUrl }).toPromise();
    if (clientResult.isError()) {
      throw clientResult.getError();
    }
    const client = clientResult.value;

    const result1 = await client.publish("testPublisher", { id: "1", count: 1 }).toPromise();
    const result2 = await client.publish("testPublisher", { id: "2", count: 2 }).toPromise();
    const result3 = await client.publish("testPublisher", { id: "3", count: 3 }).toPromise();

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
    await client.close().toPromise();
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
    const workerResult = await TypedAmqpWorker.create({
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
      connection: amqpConnectionUrl,
    }).toPromise();
    if (workerResult.isError()) {
      throw workerResult.getError();
    }
    const worker = workerResult.value;

    // WHEN - Publish messages to both queues
    const clientResult = await TypedAmqpClient.create({ contract, connection: amqpConnectionUrl }).toPromise();
    if (clientResult.isError()) {
      throw clientResult.getError();
    }
    const client = clientResult.value;

    const result1 = await client.publish("pub1", { id: "msg1" }).toPromise();
    const result2 = await client.publish("pub2", { id: "msg2" }).toPromise();

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    // THEN - Wait for messages to be consumed
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages1).toEqual([{ id: "msg1" }]);
    expect(messages2).toEqual([{ id: "msg2" }]);

    // CLEANUP
    await worker.close();
    await client.close().toPromise();
  });
});
