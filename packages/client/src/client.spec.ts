import { describe, it, expect, vi, beforeEach } from "vitest";
import { AmqpClient, createClient } from "./client";
import type { ChannelModel, Channel } from "amqplib";
import { defineContract, defineMessage } from "@amqp-contract/contract";
import { z } from "zod";

// Mock types for testing
const mockChannel: Channel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  assertQueue: vi.fn().mockResolvedValue(undefined),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockReturnValue(true),
  close: vi.fn().mockResolvedValue(undefined),
  prefetch: vi.fn().mockResolvedValue(undefined),
};

const mockConnection: ChannelModel = {
  createChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
};

describe("AmqpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Type Inference", () => {
    it("should infer publisher names correctly", () => {
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
            durable: true,
          },
        },
        publishers: {
          testPublisher: {
            exchange: "test-exchange",
            message: TestMessage,
          },
        },
      });

      const client = createClient(contract);

      // Type inference test - this should compile without errors
      type PublisherNames = Parameters<typeof client.publish>[0];
      const name: PublisherNames = "testPublisher";
      expect(name).toBe("testPublisher");
    });

    it("should infer message types correctly", async () => {
      const OrderMessage = defineMessage(
        "OrderMessage",
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );

      const contract = defineContract({
        exchanges: {
          orders: {
            name: "orders",
            type: "topic" as const,
            durable: true,
          },
        },
        publishers: {
          createOrder: {
            exchange: "orders",
            routingKey: "order.created",
            message: OrderMessage,
          },
        },
      });

      const client = createClient(contract);
      await client.connect(mockConnection);

      // Type inference test - message type should be inferred correctly
      await client.publish("createOrder", {
        orderId: "123",
        amount: 100,
      });

      expect(mockChannel.publish).toHaveBeenCalledWith(
        "orders",
        "order.created",
        expect.any(Buffer),
        undefined,
      );
    });
  });

  describe("connect", () => {
    it("should connect and setup exchanges", async () => {
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
            durable: true,
            autoDelete: false,
          },
        },
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith("test-exchange", "topic", {
        durable: true,
        autoDelete: false,
        internal: undefined,
        arguments: undefined,
      });
    });

    it("should setup queues when defined", async () => {
      const contract = defineContract({
        queues: {
          testQueue: {
            name: "test-queue",
            durable: true,
            exclusive: false,
          },
        },
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith("test-queue", {
        durable: true,
        exclusive: false,
        autoDelete: undefined,
        arguments: undefined,
      });
    });

    it("should setup bindings when defined", async () => {
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
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);

      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "test-queue",
        "test-exchange",
        "test.#",
        undefined,
      );
    });
  });

  describe("publish", () => {
    it("should throw error when not connected", async () => {
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
        publishers: {
          testPublisher: {
            exchange: "test-exchange",
            message: TestMessage,
          },
        },
      });

      const client = new AmqpClient(contract);

      await expect(client.publish("testPublisher", { id: "123" })).rejects.toThrow(
        "Client not connected. Call connect() first.",
      );
    });

    it("should publish a valid message", async () => {
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
        publishers: {
          testPublisher: {
            exchange: "test-exchange",
            routingKey: "test.key",
            message: TestMessage,
          },
        },
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);

      const result = await client.publish("testPublisher", { id: "123" });

      expect(result).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.key",
        Buffer.from(JSON.stringify({ id: "123" })),
        undefined,
      );
    });

    it("should use custom routing key from options", async () => {
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
        publishers: {
          testPublisher: {
            exchange: "test-exchange",
            routingKey: "test.default",
            message: TestMessage,
          },
        },
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);

      await client.publish("testPublisher", { id: "123" }, { routingKey: "test.custom" });

      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.custom",
        expect.any(Buffer),
        undefined,
      );
    });

    it("should validate message and throw on invalid data", async () => {
      const TestMessage = defineMessage("TestMessage", z.object({ id: z.string() }));

      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
        publishers: {
          testPublisher: {
            exchange: "test-exchange",
            message: TestMessage,
          },
        },
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);

      // @ts-expect-error - testing runtime validation with invalid data
      await expect(client.publish("testPublisher", { id: 123 })).rejects.toThrow();
    });
  });

  describe("close", () => {
    it("should close channel and connection", async () => {
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
      });

      const client = new AmqpClient(contract);
      await client.connect(mockConnection);
      await client.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it("should handle close when not connected", async () => {
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
      });

      const client = new AmqpClient(contract);
      await expect(client.close()).resolves.toBeUndefined();
    });
  });

  describe("createClient", () => {
    it("should create a client instance", () => {
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
      });

      const client = createClient(contract);
      expect(client).toBeInstanceOf(AmqpClient);
    });
  });
});
