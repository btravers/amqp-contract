import { describe, expect, vi } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { createWorker } from "./worker.js";
import { createClient } from "@amqp-contract/client";
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
  describe("end-to-end message consumption", () => {
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

      const handler = vi.fn();
      const worker = createWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("testConsumer");

      // WHEN - Publish a message using the client
      const client = createClient(contract);
      await client.connect(amqpConnection);
      await client.publish("testPublisher", {
        id: "123",
        message: "Hello from integration test!",
      });

      // THEN - Wait for message to be consumed
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(handler).toHaveBeenCalledWith({
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

      const handler = vi.fn();
      const worker = createWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("testConsumer");

      // WHEN - Publish multiple messages
      const client = createClient(contract);
      await client.connect(amqpConnection);

      await client.publish("testPublisher", { id: "1", count: 1 });
      await client.publish("testPublisher", { id: "2", count: 2 });
      await client.publish("testPublisher", { id: "3", count: 3 });

      // THEN - Wait for all messages to be consumed
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledWith({ id: "1", count: 1 });
      expect(handler).toHaveBeenCalledWith({ id: "2", count: 2 });
      expect(handler).toHaveBeenCalledWith({ id: "3", count: 3 });

      // CLEANUP
      await worker.close();
      await client.close();
    });

    it("should handle invalid messages by nacking them", async ({ amqpConnection }) => {
      // GIVEN
      const TestMessage = z.object({
        id: z.string(),
        value: z.number().positive(),
      });

      const contract = defineContract({
        exchanges: {
          test: defineExchange("worker-invalid-exchange", "topic", { durable: false }),
        },
        queues: {
          testQueue: defineQueue("worker-invalid-queue", { durable: false }),
        },
        bindings: {
          testBinding: defineBinding("worker-invalid-queue", "worker-invalid-exchange", {
            routingKey: "invalid.#",
          }),
        },
        consumers: {
          testConsumer: defineConsumer("worker-invalid-queue", TestMessage),
        },
      });

      const handler = vi.fn();
      const worker = createWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("testConsumer");

      // WHEN - Manually publish an invalid message (bypassing client validation)
      const channel = await amqpConnection.createChannel();
      await channel.assertExchange("worker-invalid-exchange", "topic", { durable: false });
      await channel.assertQueue("worker-invalid-queue", { durable: false });
      await channel.bindQueue("worker-invalid-queue", "worker-invalid-exchange", "invalid.#");

      channel.publish(
        "worker-invalid-exchange",
        "invalid.test",
        Buffer.from(JSON.stringify({ id: "123", value: -5 })), // Invalid: negative value
      );

      // THEN - Wait and verify handler was not called
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(handler).not.toHaveBeenCalled();

      // CLEANUP
      await channel.close();
      await worker.close();
    });
  });

  describe("consume patterns", () => {
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

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const worker = createWorker(contract, {
        consumer1: handler1,
        consumer2: handler2,
      });

      await worker.connect(amqpConnection);
      await worker.consumeAll();

      // WHEN - Publish messages to both queues
      const client = createClient(contract);
      await client.connect(amqpConnection);

      await client.publish("pub1", { id: "msg1" });
      await client.publish("pub2", { id: "msg2" });

      // THEN - Wait for messages to be consumed
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(handler1).toHaveBeenCalledWith({ id: "msg1" });
      expect(handler2).toHaveBeenCalledWith({ id: "msg2" });

      // CLEANUP
      await worker.close();
      await client.close();
    });

    it("should stop consuming with stopConsuming", async ({ amqpConnection }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });

      const contract = defineContract({
        exchanges: {
          test: defineExchange("worker-stop-exchange", "topic", { durable: false }),
        },
        queues: {
          testQueue: defineQueue("worker-stop-queue", { durable: false }),
        },
        bindings: {
          testBinding: defineBinding("worker-stop-queue", "worker-stop-exchange", {
            routingKey: "stop.#",
          }),
        },
        publishers: {
          testPublisher: definePublisher("worker-stop-exchange", TestMessage, {
            routingKey: "stop.test",
          }),
        },
        consumers: {
          testConsumer: defineConsumer("worker-stop-queue", TestMessage),
        },
      });

      const handler = vi.fn();
      const worker = createWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("testConsumer");

      const client = createClient(contract);
      await client.connect(amqpConnection);

      // Publish first message
      await client.publish("testPublisher", { id: "msg1" });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(handler).toHaveBeenCalledTimes(1);

      // WHEN - Stop consuming
      await worker.stopConsuming();

      // Publish second message
      await client.publish("testPublisher", { id: "msg2" });
      await new Promise((resolve) => setTimeout(resolve, 300));

      // THEN - Handler should not be called again
      expect(handler).toHaveBeenCalledTimes(1);

      // CLEANUP
      await worker.close();
      await client.close();
    });
  });

  describe("prefetch settings", () => {
    it("should respect prefetch settings", async ({ amqpConnection }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });

      const contract = defineContract({
        exchanges: {
          test: defineExchange("worker-prefetch-exchange", "topic", { durable: false }),
        },
        queues: {
          testQueue: defineQueue("worker-prefetch-queue", { durable: false }),
        },
        bindings: {
          testBinding: defineBinding("worker-prefetch-queue", "worker-prefetch-exchange", {
            routingKey: "prefetch.#",
          }),
        },
        publishers: {
          testPublisher: definePublisher("worker-prefetch-exchange", TestMessage, {
            routingKey: "prefetch.test",
          }),
        },
        consumers: {
          testConsumer: defineConsumer("worker-prefetch-queue", TestMessage, {
            prefetch: 1, // Process one message at a time
          }),
        },
      });

      const handler = vi.fn(async () => {
        // Simulate slow processing
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      const worker = createWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(amqpConnection);
      await worker.consume("testConsumer");

      // WHEN - Publish messages
      const client = createClient(contract);
      await client.connect(amqpConnection);

      await client.publish("testPublisher", { id: "1" });
      await client.publish("testPublisher", { id: "2" });

      // THEN - Messages should be processed sequentially
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(handler).toHaveBeenCalledTimes(2);

      // CLEANUP
      await worker.close();
      await client.close();
    });
  });
});
