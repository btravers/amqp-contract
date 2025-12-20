import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { TypedAmqpWorker } from "./worker.js";
import { TypedAmqpClient } from "@amqp-contract/client";
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineBinding,
  definePublisher,
  defineConsumer,
} from "@amqp-contract/contract";
import { z } from "zod";

describe("AmqpWorker Integration", () => {
  it("should consume messages from a real RabbitMQ instance", async ({ amqpConnection }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      message: z.string(),
    });

    const contract = defineContract({
      exchanges: {
        test: defineExchange("worker-test-exchange", "topic", { durable: false }),
      },
      queues: {
        testQueue: defineQueue("worker-test-queue", { durable: false }),
      },
      bindings: {
        testBinding: defineBinding("worker-test-queue", "worker-test-exchange", {
          routingKey: "test.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher("worker-test-exchange", TestMessage, {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer("worker-test-queue", TestMessage),
      },
    });

    const messages: Array<{ id: string; message: string }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: (msg) => {
          messages.push(msg);
        },
      },
      connection: amqpConnection,
    });

    // WHEN - Publish a message using the client
    const client = await TypedAmqpClient.create({ contract, connection: amqpConnection });
    await client.publish("testPublisher", {
      id: "123",
      message: "Hello from integration test!",
    });

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

  it("should handle multiple messages", async ({ amqpConnection }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      count: z.number(),
    });

    const contract = defineContract({
      exchanges: {
        test: defineExchange("worker-multi-exchange", "topic", { durable: false }),
      },
      queues: {
        testQueue: defineQueue("worker-multi-queue", { durable: false }),
      },
      bindings: {
        testBinding: defineBinding("worker-multi-queue", "worker-multi-exchange", {
          routingKey: "multi.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher("worker-multi-exchange", TestMessage, {
          routingKey: "multi.test",
        }),
      },
      consumers: {
        testConsumer: defineConsumer("worker-multi-queue", TestMessage),
      },
    });

    const messages: Array<{ id: string; count: number }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: (msg) => {
          messages.push(msg);
        },
      },
      connection: amqpConnection,
    });

    // WHEN - Publish multiple messages
    const client = await TypedAmqpClient.create({ contract, connection: amqpConnection });

    await client.publish("testPublisher", { id: "1", count: 1 });
    await client.publish("testPublisher", { id: "2", count: 2 });
    await client.publish("testPublisher", { id: "3", count: 3 });

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

  it("should consume all consumers with consumeAll", async ({ amqpConnection }) => {
    // GIVEN
    const TestMessage = z.object({ id: z.string() });

    const contract = defineContract({
      exchanges: {
        test: defineExchange("worker-all-exchange", "topic", { durable: false }),
      },
      queues: {
        queue1: defineQueue("worker-all-queue1", { durable: false }),
        queue2: defineQueue("worker-all-queue2", { durable: false }),
      },
      bindings: {
        binding1: defineBinding("worker-all-queue1", "worker-all-exchange", {
          routingKey: "all.one",
        }),
        binding2: defineBinding("worker-all-queue2", "worker-all-exchange", {
          routingKey: "all.two",
        }),
      },
      publishers: {
        pub1: definePublisher("worker-all-exchange", TestMessage, {
          routingKey: "all.one",
        }),
        pub2: definePublisher("worker-all-exchange", TestMessage, {
          routingKey: "all.two",
        }),
      },
      consumers: {
        consumer1: defineConsumer("worker-all-queue1", TestMessage),
        consumer2: defineConsumer("worker-all-queue2", TestMessage),
      },
    });

    const messages1: Array<{ id: string }> = [];
    const messages2: Array<{ id: string }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        consumer1: (msg) => {
          messages1.push(msg);
        },
        consumer2: (msg) => {
          messages2.push(msg);
        },
      },
      connection: amqpConnection,
    });

    // WHEN - Publish messages to both queues
    const client = await TypedAmqpClient.create({ contract, connection: amqpConnection });

    await client.publish("pub1", { id: "msg1" });
    await client.publish("pub2", { id: "msg2" });

    // THEN - Wait for messages to be consumed
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages1).toEqual([{ id: "msg1" }]);
    expect(messages2).toEqual([{ id: "msg2" }]);

    // CLEANUP
    await worker.close();
    await client.close();
  });
});
