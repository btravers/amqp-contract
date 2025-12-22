import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedAmqpClient } from "./client";
import type { Channel, ChannelModel } from "amqplib";
import { connect } from "amqplib";
import { defineContract, defineMessage } from "@amqp-contract/contract";
import { Result } from "@swan-io/boxed";
import { z } from "zod";

// Mock amqplib connect function
vi.mock("amqplib", () => ({
  connect: vi.fn(),
}));

// Mock types for testing
const mockChannel = {
  assertExchange: vi.fn().mockResolvedValue(undefined),
  assertQueue: vi.fn().mockResolvedValue(undefined),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  bindExchange: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockReturnValue(true),
  close: vi.fn().mockResolvedValue(undefined),
  prefetch: vi.fn().mockResolvedValue(undefined),
} as unknown as Channel;

const mockConnection = {
  createChannel: vi.fn().mockResolvedValue(mockChannel),
  close: vi.fn().mockResolvedValue(undefined),
} as unknown as ChannelModel;

describe("AmqpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementation
    vi.mocked(connect).mockResolvedValue(mockConnection);
  });

  describe("Type Inference", () => {
    it("should infer publisher names correctly", async () => {
      // GIVEN
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

      // WHEN
      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // THEN
      // Type inference test - this should compile without errors
      type PublisherNames = Parameters<typeof client.publish>[0];
      const name: PublisherNames = "testPublisher";
      expect(name).toBe("testPublisher");
    });

    it("should infer message types correctly", async () => {
      // GIVEN
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

      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // WHEN
      // Type inference test - message type should be inferred correctly
      await client.publish("createOrder", {
        orderId: "123",
        amount: 100,
      });

      // THEN
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
      });

      // WHEN
      await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

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
      });

      // WHEN
      await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

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
            type: "queue" as const,
            queue: "test-queue",
            exchange: "test-exchange",
            routingKey: "test.#",
          },
        },
      });

      // WHEN
      await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // THEN
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "test-queue",
        "test-exchange",
        "test.#",
        undefined,
      );
    });

    it("should setup exchange-to-exchange bindings when defined", async () => {
      // GIVEN
      const contract = defineContract({
        exchanges: {
          sourceExchange: {
            name: "source-exchange",
            type: "topic" as const,
          },
          destinationExchange: {
            name: "destination-exchange",
            type: "topic" as const,
          },
        },
        bindings: {
          exchangeBinding: {
            type: "exchange" as const,
            source: "source-exchange",
            destination: "destination-exchange",
            routingKey: "test.*",
          },
        },
      });

      // WHEN
      await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // THEN
      expect(mockChannel.bindExchange).toHaveBeenCalledWith(
        "destination-exchange",
        "source-exchange",
        "test.*",
        undefined,
      );
    });
  });

  describe("publish", () => {
    it("should publish a valid message", async () => {
      // GIVEN
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

      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // WHEN
      const result = client.publish("testPublisher", { id: "123" });

      // THEN
      expect(result).toEqual(Result.Ok(true));
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.key",
        Buffer.from(JSON.stringify({ id: "123" })),
        undefined,
      );
    });

    it("should use custom routing key from options", async () => {
      // GIVEN
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

      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // WHEN
      const result = client.publish("testPublisher", { id: "123" }, { routingKey: "test.custom" });

      // THEN
      expect(result).toEqual(Result.Ok(true));
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.custom",
        expect.any(Buffer),
        undefined,
      );
    });

    it("should return error on invalid data", async () => {
      // GIVEN
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

      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // WHEN
      // @ts-expect-error - testing runtime validation with invalid data
      const result = client.publish("testPublisher", { id: 123 });

      // THEN
      expect(result).toMatchObject({
        tag: "Error",
        error: { name: "MessageValidationError" },
      });
    });
  });

  describe("close", () => {
    it("should close channel and connection", async () => {
      // GIVEN
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
      });

      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // WHEN
      await client.close();

      // THEN
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it("should handle close when not connected", async () => {
      // GIVEN
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
      });

      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // WHEN / THEN
      await expect(client.close()).resolves.toBeUndefined();
    });
  });

  describe("TypedAmqpClient.create", () => {
    it("should create a client instance and connect automatically", async () => {
      // GIVEN
      const contract = defineContract({
        exchanges: {
          test: {
            name: "test-exchange",
            type: "topic" as const,
          },
        },
      });

      // WHEN
      const client = await TypedAmqpClient.create({ contract, connection: "amqp://localhost" });

      // THEN
      expect(client).toBeInstanceOf(TypedAmqpClient);
      expect(mockConnection.createChannel).toHaveBeenCalled();
    });
  });
});
