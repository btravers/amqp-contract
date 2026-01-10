import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { defineUnsafeHandler } from "../handlers.js";
import { it } from "./fixture.js";
import { TypedAmqpWorker } from "../worker.js";
import { z } from "zod";

describe("AmqpWorker Integration", () => {
  it("should consume messages from a real RabbitMQ instance", async ({
    workerFactory,
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
    await workerFactory(contract, {
      testConsumer: (msg) => {
        messages.push(msg);
        return Promise.resolve();
      },
    });

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
  });

  it("should handle multiple messages", async ({ workerFactory, publishMessage }) => {
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
    await workerFactory(contract, {
      testConsumer: (msg) => {
        messages.push(msg);
        return Promise.resolve();
      },
    });

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
  });

  it("should consume all consumers with consumeAll", async ({ workerFactory, publishMessage }) => {
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

    await workerFactory(contract, {
      consumer1: (msg) => {
        messages1.push(msg);
        return Promise.resolve();
      },
      consumer2: (msg) => {
        messages2.push(msg);
        return Promise.resolve();
      },
    });

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
  });

  it("should handle validation errors and nack messages", async ({
    workerFactory,
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
    await workerFactory(contract, {
      testConsumer: (msg) => {
        messages.push(msg);
        return Promise.resolve();
      },
    });

    // WHEN - Publish invalid message
    publishMessage(exchange.name, "validation.message", {
      id: "invalid",
      count: "not-a-number", // Invalid type
    });

    // THEN - Message should not be processed (validation failed)
    // Wait a moment to ensure message would have been processed if valid
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(messages).toHaveLength(0);
  });

  it("should handle handler errors and requeue messages", async ({
    workerFactory,
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
    await workerFactory(contract, {
      testConsumer: async (msg) => {
        attemptCount++;
        if (msg.shouldFail && attemptCount === 1) {
          throw new Error("Handler error on first attempt");
        }
        messages.push(msg);
      },
    });

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
  });

  it("should handle exchange-to-exchange bindings", async ({ workerFactory, publishMessage }) => {
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
    await workerFactory(contract, {
      destConsumer: (msg) => {
        messages.push(msg);
        return Promise.resolve();
      },
    });

    // WHEN - Publish to source exchange
    publishMessage(sourceExchange.name, "test.important", { msg: "routed through exchange" });

    // THEN
    await vi.waitFor(() => {
      if (messages.length < 1) {
        throw new Error("Message not yet consumed");
      }
    });

    expect(messages).toEqual([{ msg: "routed through exchange" }]);
  });

  it("should close cleanly and stop consuming", async ({ workerFactory, publishMessage }) => {
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
    const worker = await workerFactory(contract, {
      testConsumer: (msg) => {
        messages.push(msg);
        return Promise.resolve();
      },
    });

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
    workerFactory,
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

    await workerFactory(contract, {
      orderConsumer: (msg) => {
        orders.push(msg);
        return Promise.resolve();
      },
      notificationConsumer: (msg) => {
        notifications.push(msg);
        return Promise.resolve();
      },
    });

    // WHEN
    publishMessage(exchange.name, "order.created", { orderId: "123", amount: 99.99 });
    publishMessage(exchange.name, "notification.email", {
      userId: "user1",
      message: "Order created",
    });

    // THEN
    await vi.waitFor(() => {
      if (orders.length + notifications.length < 2) {
        throw new Error("Messages not yet consumed");
      }
    });

    expect(orders).toEqual([{ orderId: "123", amount: 99.99 }]);
    expect(notifications).toEqual([{ userId: "user1", message: "Order created" }]);
  });

  it("should handle consumer cancellation by RabbitMQ (null message)", async ({
    amqpConnection,
  }) => {
    // GIVEN
    const exchange = defineExchange("worker-cancel-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-cancel-queue", { durable: false });

    // Setup exchange and queue manually using an admin channel
    const adminChannel = await amqpConnection.createChannel();
    await adminChannel.assertExchange(exchange.name, exchange.type, { durable: false });
    await adminChannel.assertQueue(queue.name, { durable: false });
    await adminChannel.bindQueue(queue.name, exchange.name, "cancel.#");

    // Create a mock handler to track messages received
    const messageHandler = vi.fn();

    // Create a consumer directly using amqplib to test null message handling
    const consumerChannel = await amqpConnection.createChannel();
    await consumerChannel.consume(queue.name, messageHandler, {
      noAck: true,
    });

    // Wait for consumer to be set up
    const CONSUMER_SETUP_WAIT_MS = 500;
    await new Promise((resolve) => setTimeout(resolve, CONSUMER_SETUP_WAIT_MS));

    // WHEN - Delete the queue, which causes RabbitMQ
    // to cancel the consumer and send a null message to the consumer callback
    await adminChannel.deleteQueue(queue.name);

    // THEN - Wait for the null message to be received
    await vi.waitFor(
      () => {
        const nullMessageReceived = messageHandler.mock.calls.some((call) => call[0] === null);
        if (!nullMessageReceived) {
          throw new Error("Null message not yet received");
        }
      },
      { timeout: 2000 },
    );

    expect(messageHandler).toHaveBeenCalledWith(null);

    // Clean up
    await adminChannel.close();
    await consumerChannel.close();
  });

  it("should create worker with proper null message handling infrastructure", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({ id: z.string() });

    const exchange = defineExchange("worker-cancel-log-exchange", "topic", { durable: false });
    const queue = defineQueue("worker-cancel-log-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        testQueue: queue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "cancel.#",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    // Create a mock logger to capture warnings
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create worker with mock logger
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: {
        testConsumer: defineUnsafeHandler(contract, "testConsumer", async (_msg) => {
          // No-op handler
        }),
      },
      urls: [amqpConnectionUrl],
      logger: mockLogger,
    }).resultToPromise();

    // Wait for worker setup
    const WORKER_SETUP_WAIT_MS = 500;
    await new Promise((resolve) => setTimeout(resolve, WORKER_SETUP_WAIT_MS));

    // WHEN - Verify consumer is working by publishing and consuming a test message
    publishMessage(exchange.name, "cancel.test", { id: "test" });
    await vi.waitFor(
      () => {
        const infoCalls = mockLogger.info.mock.calls;
        if (!infoCalls.some((call) => call[0] === "Message consumed successfully")) {
          throw new Error("Test message not yet consumed");
        }
      },
      { timeout: 2000 },
    );

    // THEN - Verify the worker was created successfully and can consume messages
    // The worker code has null message handling that will log "Consumer cancelled
    // by server" when RabbitMQ sends a null message during consumer cancellation
    expect(mockLogger.info).toHaveBeenCalledWith(
      "Message consumed successfully",
      expect.objectContaining({
        consumerName: "testConsumer",
        queueName: queue.name,
      }),
    );

    // Verify no unexpected warnings were logged during normal operation
    expect(mockLogger.warn).not.toHaveBeenCalled();

    // Clean up
    await worker.close().resultToPromise();
  });
});
