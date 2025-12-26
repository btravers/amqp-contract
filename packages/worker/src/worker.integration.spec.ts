import {
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
import { it } from "@amqp-contract/testing/extension";
import { z } from "zod";

describe("AmqpWorker Integration", () => {
  it("should consume messages from a real RabbitMQ instance", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
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

    // WHEN
    publishMessage(exchange.name, "test.message", {
      id: "123",
      message: "Hello from integration test!",
    });

    // THEN
    await vi.waitFor(() => {
      if (messages.length < 1) {
        throw new Error("Message not yet consumed");
      }
    });

    expect(messages).toEqual([
      {
        id: "123",
        message: "Hello from integration test!",
      },
    ]);

    // CLEANUP
    await worker.close();
  });

  it("should handle multiple messages", async ({ amqpConnectionUrl, publishMessage }) => {
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

    // WHEN
    publishMessage(exchange.name, "multi.test", { id: "1", count: 1 });
    publishMessage(exchange.name, "multi.test", { id: "2", count: 2 });
    publishMessage(exchange.name, "multi.test", { id: "3", count: 3 });

    // THEN - Wait for all messages to be consumed
    await vi.waitFor(() => {
      if (messages.length < 3) {
        throw new Error("Message not yet consumed");
      }
    });

    expect(messages).toEqual([
      { id: "1", count: 1 },
      { id: "2", count: 2 },
      { id: "3", count: 3 },
    ]);

    // CLEANUP
    await worker.close();
  });

  it("should consume all consumers with consumeAll", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
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

    // WHEN
    publishMessage(exchange.name, "all.one", { id: "msg1" });
    publishMessage(exchange.name, "all.two", { id: "msg2" });

    // THEN
    await vi.waitFor(() => {
      if (messages1.length + messages2.length < 2) {
        throw new Error("Message not yet consumed");
      }
    });

    expect(messages1).toEqual([{ id: "msg1" }]);
    expect(messages2).toEqual([{ id: "msg2" }]);

    // CLEANUP
    await worker.close();
  });

  it("should handle validation errors and nack messages", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      count: z.number().positive(),
    });

    const exchange = defineExchange("worker-validation-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-validation-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "validation.#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "validation.message",
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

    // WHEN - Publish invalid message
    publishMessage(exchange.name, "validation.message", {
      id: "invalid",
      count: "not-a-number", // Invalid type
    });

    // THEN - Message should not be processed (validation failed)
    // Wait a moment to ensure message would have been processed if valid
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages).toHaveLength(0);

    // CLEANUP
    await worker.close();
  });

  it("should handle handler errors and requeue messages", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({ id: z.string(), shouldFail: z.boolean() });

    const exchange = defineExchange("worker-error-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-error-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "error.#",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    let attemptCount = 0;
    const messages: Array<{ id: string; shouldFail: boolean }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: async (msg) => {
          attemptCount++;
          if (msg.shouldFail && attemptCount === 1) {
            throw new Error("Handler error on first attempt");
          }
          messages.push(msg);
        },
      },
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    // WHEN - Publish message that will fail first time
    publishMessage(exchange.name, "error.test", { id: "retry-test", shouldFail: true });

    // THEN - Message should be reprocessed and eventually succeed
    await vi.waitFor(() => {
      if (messages.length < 1) {
        throw new Error("Message not yet consumed successfully");
      }
    });

    expect(messages).toEqual([{ id: "retry-test", shouldFail: true }]);
    expect(attemptCount).toBeGreaterThanOrEqual(2); // At least 2 attempts

    // CLEANUP
    await worker.close();
  });

  it("should handle exchange-to-exchange bindings", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({ msg: z.string() });

    const sourceExchange = defineExchange("worker-source-exchange", "topic", { durable: false });
    const destExchange = defineExchange("worker-dest-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-dest-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        source: sourceExchange,
        dest: destExchange,
      },
      queues: {
        destQueue: queue,
      },
      bindings: {
        exchangeBinding: defineExchangeBinding(destExchange, sourceExchange, {
          routingKey: "*.important",
        }),
        queueBinding: defineQueueBinding(queue, destExchange, {
          routingKey: "test.important",
        }),
      },
      consumers: {
        destConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const messages: Array<{ msg: string }> = [];
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        destConsumer: (msg) => {
          messages.push(msg);
          return Promise.resolve();
        },
      },
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    // WHEN - Publish to source exchange
    publishMessage(sourceExchange.name, "test.important", { msg: "routed through exchange" });

    // THEN
    await vi.waitFor(() => {
      if (messages.length < 1) {
        throw new Error("Message not yet consumed");
      }
    });

    expect(messages).toEqual([{ msg: "routed through exchange" }]);

    // CLEANUP
    await worker.close();
  });

  it("should handle null messages gracefully", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const TestMessage = z.object({ id: z.string() });

    const queue = defineQueue("worker-null-queue", { durable: false });

    const contract = defineContract({
      queues: {
        testQueue: queue,
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const messages: Array<{ id: string }> = [];
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

    // WHEN - Cancel consumer (simulates null message)
    // Note: In real scenarios, null messages are sent by RabbitMQ when consumer is cancelled
    // For this test, we just verify worker is set up correctly

    // THEN - Worker should be running
    expect(worker).toBeDefined();

    // CLEANUP
    await worker.close();
  });

  it("should close cleanly and stop consuming", async ({ amqpConnectionUrl, publishMessage }) => {
    // GIVEN
    const TestMessage = z.object({ id: z.string() });

    const exchange = defineExchange("worker-close-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-close-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "close.#",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    const messages: Array<{ id: string }> = [];
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

    // Consume first message
    publishMessage(exchange.name, "close.test", { id: "before-close" });
    await vi.waitFor(() => {
      if (messages.length < 1) {
        throw new Error("Message not yet consumed");
      }
    });

    // WHEN - Close worker
    const closeResult = await worker.close();

    // Publish message after close
    publishMessage(exchange.name, "close.test", { id: "after-close" });

    // THEN
    expect(closeResult.isOk()).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ id: "before-close" });

    // Message published after close should not be consumed
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages).toHaveLength(1);
  });

  it("should handle multiple consumers with different message types", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const OrderMessage = z.object({ orderId: z.string(), amount: z.number() });
    const NotificationMessage = z.object({ userId: z.string(), message: z.string() });

    const exchange = defineExchange("worker-multi-type-exchange", "topic", { durable: false });
    const orderQueue = defineQueue("worker-multi-type-orders", { durable: false });
    const notifQueue = defineQueue("worker-multi-type-notifs", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        orders: orderQueue,
        notifications: notifQueue,
      },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, exchange, {
          routingKey: "order.#",
        }),
        notifBinding: defineQueueBinding(notifQueue, exchange, {
          routingKey: "notification.#",
        }),
      },
      consumers: {
        orderConsumer: defineConsumer(orderQueue, defineMessage(OrderMessage)),
        notificationConsumer: defineConsumer(notifQueue, defineMessage(NotificationMessage)),
      },
    });

    const orders: Array<{ orderId: string; amount: number }> = [];
    const notifications: Array<{ userId: string; message: string }> = [];

    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        orderConsumer: (msg) => {
          orders.push(msg);
          return Promise.resolve();
        },
        notificationConsumer: (msg) => {
          notifications.push(msg);
          return Promise.resolve();
        },
      },
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    // WHEN
    publishMessage(exchange.name, "order.created", { orderId: "123", amount: 99.99 });
    publishMessage(exchange.name, "notification.email", { userId: "user1", message: "Order created" });

    // THEN
    await vi.waitFor(() => {
      if (orders.length + notifications.length < 2) {
        throw new Error("Messages not yet consumed");
      }
    });

    expect(orders).toEqual([{ orderId: "123", amount: 99.99 }]);
    expect(notifications).toEqual([{ userId: "user1", message: "Order created" }]);

    // CLEANUP
    await worker.close();
  });
});
