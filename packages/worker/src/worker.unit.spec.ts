import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedAmqpWorker } from "./worker";
import type { Channel, ConsumeMessage } from "amqplib";
import { connect } from "amqplib";
import { defineContract, defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

// Mock amqplib connect function
vi.mock("amqplib", () => ({
  connect: vi.fn(),
}));

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
};

describe("AmqpWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsumeCallback = null;
    // Setup default mock implementation
    vi.mocked(connect).mockResolvedValue(mockConnection);
  });

  describe("Type Inference", () => {
    it("should infer consumer names correctly", async () => {
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
      await TypedAmqpWorker.create({
        contract,
        handlers,
        connection: "amqp://localhost",
      });

      // THEN
      // Type inference test - this should compile without errors
      // Since consume is private, we verify type inference through handlers
      type HandlerKeys = keyof typeof handlers;
      const name: HandlerKeys = "testConsumer";
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
      await TypedAmqpWorker.create({
        contract,
        handlers: { processOrder: handler },
        connection: "amqp://localhost",
      });

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

      // WHEN
      await TypedAmqpWorker.create({ contract, handlers: {}, connection: "amqp://localhost" });

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

      // WHEN
      await TypedAmqpWorker.create({ contract, handlers: {}, connection: "amqp://localhost" });

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

      // WHEN
      await TypedAmqpWorker.create({ contract, handlers: {}, connection: "amqp://localhost" });

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
      await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: handler },
        connection: "amqp://localhost",
      });

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

      // WHEN
      await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: vi.fn() },
        connection: "amqp://localhost",
      });

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
      await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: handler },
        connection: "amqp://localhost",
      });

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
      await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: handler },
        connection: "amqp://localhost",
      });

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
      await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: handler },
        connection: "amqp://localhost",
      });

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
      await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: handler },
        connection: "amqp://localhost",
      });

      // WHEN
      await mockConsumeCallback?.(null);

      // THEN
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("consumeAll", () => {
    it("should consume all consumers automatically on TypedAmqpWorker.create", async () => {
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

      // WHEN
      await TypedAmqpWorker.create({
        contract,
        handlers: {
          consumer1: vi.fn(),
          consumer2: vi.fn(),
        },
        connection: "amqp://localhost",
      });

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

      // WHEN / THEN
      await expect(
        TypedAmqpWorker.create({ contract, handlers: {}, connection: "amqp://localhost" }),
      ).rejects.toThrow("No consumers defined in contract");
    });
  });

  describe("close", () => {
    it("should stop consuming and close channel and connection", async () => {
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

      const worker = await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: vi.fn() },
        connection: "amqp://localhost",
      });

      // WHEN
      await worker.close();

      // THEN
      expect(mockChannel.cancel).toHaveBeenCalled();
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });

  describe("TypedAmqpWorker.create", () => {
    it("should create a worker instance, connect and consumeAll automatically", async () => {
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

      // WHEN
      const worker = await TypedAmqpWorker.create({
        contract,
        handlers: { testConsumer: vi.fn() },
        connection: "amqp://localhost",
      });

      // THEN
      expect(worker).toBeInstanceOf(TypedAmqpWorker);
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.consume).toHaveBeenCalled();
    });
  });
});
