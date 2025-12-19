import { describe, it, expect, vi, beforeEach } from "vitest";
import { AmqpWorker, createWorker } from "./worker";
import type { ChannelModel, Channel, ConsumeMessage } from "amqplib";
import { defineContract, defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

// Mock types for testing
let mockConsumeCallback: ((msg: ConsumeMessage | null) => Promise<void>) | null = null;

const mockChannel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  assertQueue: vi.fn().mockResolvedValue(undefined),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  prefetch: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn().mockImplementation((_queue: string, callback) => {
    mockConsumeCallback = callback;
    return Promise.resolve({ consumerTag: "test-tag" });
  }),
  ack: vi.fn(),
  nack: vi.fn(),
  cancel: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
} as unknown as Channel;

const mockConnection = {
  createChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
} as unknown as ChannelModel;

describe("AmqpWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeCallback = null;
  });

  describe("Type Inference", () => {
    it("should infer consumer names correctly", () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          testQueue: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const handlers = {
        testConsumer: vi.fn(),
      };

      // WHEN
      const worker = createWorker(contract, handlers);

      // THEN
      // Type inference test - this should compile without errors
      type ConsumerNames = Parameters<typeof worker.consume>[0];
      const name: ConsumerNames = "testConsumer";
      expect(name).toBe("testConsumer");
    });

    it("should infer handler message types correctly", async () => {
      // GIVEN
      const OrderMessage = defineMessage(
        "OrderMessage",
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );

      const contract = defineContract({
        queues: {
          orders: {
            name: "orders",
          },
        },
        consumers: {
          processOrder: {
            queue: "orders",
            message: OrderMessage,
          },
        },
      });

      const handler = vi.fn();
      const worker = createWorker(contract, {
        processOrder: handler,
      });

      await worker.connect(mockConnection);
      await worker.consume("processOrder");

      // WHEN
      // Simulate message
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ orderId: "123", amount: 100 })),
        fields: {},
        properties: {},
      } as ConsumeMessage;

      await mockConsumeCallback?.(mockMessage);

      // THEN
      // Type inference test - handler should receive correctly typed message
      expect(handler).toHaveBeenCalledWith({
        orderId: "123",
        amount: 100,
      });
    });
  });

  describe("connect", () => {
    it("should connect and setup exchanges", async () => {
      // GIVEN
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
            durable: true,
            autoDelete: false,
          },
        },
        consumers: {},
      });

      const worker = new AmqpWorker(contract, {});

      // WHEN
      await worker.connect(mockConnection);

      // THEN
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith("test-exchange", "topic", {
        durable: true,
        autoDelete: false,
        internal: undefined,
        arguments: undefined,
      });
    });

    it("should setup queues when defined", async () => {
      // GIVEN
      const contract = defineContract({
        queues: {
          testQueue: {
            name: "test-queue",
            durable: true,
            exclusive: false,
          },
        },
        consumers: {},
      });

      const worker = new AmqpWorker(contract, {});

      // WHEN
      await worker.connect(mockConnection);

      // THEN
      expect(mockChannel.assertQueue).toHaveBeenCalledWith("test-queue", {
        durable: true,
        exclusive: false,
        autoDelete: undefined,
        arguments: undefined,
      });
    });

    it("should setup bindings when defined", async () => {
      // GIVEN
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
        queues: {
          testQueue: {
            name: "test-queue",
          },
        },
        bindings: {
          testBinding: {
            queue: "test-queue",
            exchange: "test-exchange",
            routingKey: "test.#",
          },
        },
        consumers: {},
      });

      const worker = new AmqpWorker(contract, {});

      // WHEN
      await worker.connect(mockConnection);

      // THEN
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "test-queue",
        "test-exchange",
        "test.#",
        undefined,
      );
    });
  });

  describe("consume", () => {
    it("should throw error when not connected", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const worker = new AmqpWorker(contract, {
        testConsumer: vi.fn(),
      });

      // WHEN / THEN
      await expect(worker.consume("testConsumer")).rejects.toThrow(
        "Worker not connected. Call connect() first.",
      );
    });

    it("should setup consumer and process messages", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const handler = vi.fn();
      const worker = new AmqpWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(mockConnection);

      // WHEN
      await worker.consume("testConsumer");

      // THEN
      expect(mockChannel.consume).toHaveBeenCalledWith("test-queue", expect.any(Function), {
        noAck: false,
      });

      // Simulate message
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: "123" })),
        fields: {},
        properties: {},
      } as ConsumeMessage;

      await mockConsumeCallback?.(mockMessage);

      expect(handler).toHaveBeenCalledWith({ id: "123" });
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it("should set prefetch when specified", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
            prefetch: 10,
          },
        },
      });

      const worker = new AmqpWorker(contract, {
        testConsumer: vi.fn(),
      });

      await worker.connect(mockConnection);

      // WHEN
      await worker.consume("testConsumer");

      // THEN
      expect(mockChannel.prefetch).toHaveBeenCalledWith(10);
    });

    it("should nack invalid messages", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const handler = vi.fn();
      const worker = new AmqpWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(mockConnection);
      await worker.consume("testConsumer");

      // WHEN
      // Simulate invalid message
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: 123 })), // Invalid: id should be string
        fields: {},
        properties: {},
      } as ConsumeMessage;

      await mockConsumeCallback?.(mockMessage);

      // THEN
      expect(handler).not.toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });

    it("should nack and requeue on handler error", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));
      const worker = new AmqpWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(mockConnection);
      await worker.consume("testConsumer");

      // WHEN
      // Simulate message
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: "123" })),
        fields: {},
        properties: {},
      } as ConsumeMessage;

      await mockConsumeCallback?.(mockMessage);

      // THEN
      expect(handler).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });

    it("should not ack in noAck mode", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
            noAck: true,
          },
        },
      });

      const handler = vi.fn();
      const worker = new AmqpWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(mockConnection);
      await worker.consume("testConsumer");

      // WHEN
      // Simulate message
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: "123" })),
        fields: {},
        properties: {},
      } as ConsumeMessage;

      await mockConsumeCallback?.(mockMessage);

      // THEN
      expect(handler).toHaveBeenCalled();
      expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it("should handle null messages", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const handler = vi.fn();
      const worker = new AmqpWorker(contract, {
        testConsumer: handler,
      });

      await worker.connect(mockConnection);
      await worker.consume("testConsumer");

      // WHEN
      await mockConsumeCallback?.(null);

      // THEN
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("consumeAll", () => {
    it("should consume all consumers", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          queue1: {
            name: "queue1",
          },
          queue2: {
            name: "queue2",
          },
        },
        consumers: {
          consumer1: {
            queue: "queue1",
            message: TestMessage,
          },
          consumer2: {
            queue: "queue2",
            message: TestMessage,
          },
        },
      });

      const worker = new AmqpWorker(contract, {
        consumer1: vi.fn(),
        consumer2: vi.fn(),
      });

      await worker.connect(mockConnection);

      // WHEN
      await worker.consumeAll();

      // THEN
      expect(mockChannel.consume).toHaveBeenCalledTimes(2);
    });

    it("should throw error when no consumers defined", async () => {
      // GIVEN
      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
      });

      const worker = new AmqpWorker(contract, {});
      await worker.connect(mockConnection);

      // WHEN / THEN
      await expect(worker.consumeAll()).rejects.toThrow("No consumers defined in contract");
    });
  });

  describe("stopConsuming", () => {
    it("should cancel all consumers", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const worker = new AmqpWorker(contract, {
        testConsumer: vi.fn(),
      });

      await worker.connect(mockConnection);
      await worker.consume("testConsumer");

      // WHEN
      await worker.stopConsuming();

      // THEN
      expect(mockChannel.cancel).toHaveBeenCalledWith("test-tag");
    });

    it("should handle stopConsuming when not connected", async () => {
      // GIVEN
      const contract = defineContract({
        consumers: {},
      });

      const worker = new AmqpWorker(contract, {});

      // WHEN / THEN
      await expect(worker.stopConsuming()).resolves.toBeUndefined();
    });
  });

  describe("close", () => {
    it("should stop consuming and close connections", async () => {
      // GIVEN
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        queues: {
          test: {
            name: "test-queue",
          },
        },
        consumers: {
          testConsumer: {
            queue: "test-queue",
            message: TestMessage,
          },
        },
      });

      const worker = new AmqpWorker(contract, {
        testConsumer: vi.fn(),
      });

      await worker.connect(mockConnection);
      await worker.consume("testConsumer");

      // WHEN
      await worker.close();

      // THEN
      expect(mockChannel.cancel).toHaveBeenCalled();
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });

  describe("createWorker", () => {
    it("should create a worker instance", () => {
      // GIVEN
      const contract = defineContract({
        consumers: {},
      });

      // WHEN
      const worker = createWorker(contract, {});

      // THEN
      expect(worker).toBeInstanceOf(AmqpWorker);
    });
  });
});
