import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedAmqpClient } from "./client";
import {
  defineContract,
  defineMessage,
  defineExchange,
  defineQueue,
  definePublisher,
  defineQueueBinding,
  defineExchangeBinding,
} from "@amqp-contract/contract";
import { Result } from "@swan-io/boxed";
import { z } from "zod";

vi.mock("amqp-connection-manager", () => {
  const mockSetupChannel = {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    bindExchange: vi.fn().mockResolvedValue(undefined),
  };

  let setupPromise: Promise<void> | null = null;

  const mockChannel = {
    publish: vi.fn().mockImplementation(() => Promise.resolve(true)),
    close: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
    waitForConnect: vi.fn().mockImplementation(() => setupPromise || Promise.resolve()),
  };

  const mockConnection = {
    createChannel: vi
      .fn()
      .mockImplementation(
        (options?: { json?: boolean; setup?: (channel: unknown) => Promise<void> }) => {
          if (options?.setup) {
            // Execute setup function asynchronously and store the promise
            setupPromise = Promise.resolve().then(() => options.setup?.(mockSetupChannel));
          }
          return mockChannel;
        },
      ),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: {
      connect: vi.fn().mockReturnValue(mockConnection),
    },
    // Export test helpers
    _test: {
      mockSetupChannel,
      mockChannel,
      mockConnection,
    },
  };
});

// Get the test helpers
const amqpMock = await import("amqp-connection-manager");
// @ts-expect-error - accessing test helper
const { mockSetupChannel, mockChannel, mockConnection } = amqpMock._test;

describe("TypedAmqpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Type Inference", () => {
    it("should infer publisher names correctly", async () => {
      // GIVEN
      const TestMessage = defineMessage(z.object({ id: z.string() }));
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });

      const contract = defineContract({
        exchanges: {
          test: testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, TestMessage, {
            routingKey: "test.key",
          }),
        },
      });

      // WHEN
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      // THEN
      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // Type inference test - this should compile without errors
      type PublisherNames = Parameters<typeof client.publish>[0];
      const name: PublisherNames = "testPublisher";
      expect(name).toBe("testPublisher");
    });

    it("should infer message types correctly", async () => {
      // GIVEN
      const OrderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );

      const ordersExchange = defineExchange("orders", "topic", { durable: true });

      const contract = defineContract({
        exchanges: {
          orders: ordersExchange,
        },
        publishers: {
          createOrder: definePublisher(ordersExchange, OrderMessage, {
            routingKey: "order.created",
          }),
        },
      });

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // WHEN
      // Type inference test - message type should be inferred correctly
      await client.publish("createOrder", {
        orderId: "123",
        amount: 100,
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // THEN
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "orders",
        "order.created",
        {
          orderId: "123",
          amount: 100,
        },
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
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      // THEN
      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();
      expect(client).toBeDefined();
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockSetupChannel.assertExchange).toHaveBeenCalledWith("test-exchange", "topic", {
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
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      // THEN
      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();
      expect(client).toBeDefined();
      expect(mockSetupChannel.assertQueue).toHaveBeenCalledWith("test-queue", {
        durable: true,
        exclusive: false,
        autoDelete: undefined,
        arguments: undefined,
      });
    });

    it("should setup bindings when defined", async () => {
      // GIVEN
      const testExchange = defineExchange("test-exchange", "topic");
      const testQueue = defineQueue("test-queue");

      const contract = defineContract({
        exchanges: {
          test: testExchange,
        },
        queues: {
          testQueue,
        },
        bindings: {
          testBinding: defineQueueBinding(testQueue, testExchange, {
            routingKey: "test.#",
          }),
        },
      });

      // WHEN
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      // THEN
      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();
      expect(client).toBeDefined();
      expect(mockSetupChannel.bindQueue).toHaveBeenCalledWith(
        "test-queue",
        "test-exchange",
        "test.#",
        undefined,
      );
    });

    it("should setup exchange-to-exchange bindings when defined", async () => {
      // GIVEN
      const sourceExchange = defineExchange("source-exchange", "topic");
      const destinationExchange = defineExchange("destination-exchange", "topic");

      const contract = defineContract({
        exchanges: {
          sourceExchange,
          destinationExchange,
        },
        bindings: {
          exchangeBinding: defineExchangeBinding(destinationExchange, sourceExchange, {
            routingKey: "test.*",
          }),
        },
      });

      // WHEN
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      // THEN
      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();
      expect(client).toBeDefined();
      expect(mockSetupChannel.bindExchange).toHaveBeenCalledWith(
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
      const TestMessage = defineMessage(z.object({ id: z.string() }));
      const testExchange = defineExchange("test-exchange", "topic");

      const contract = defineContract({
        exchanges: {
          test: testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, TestMessage, {
            routingKey: "test.key",
          }),
        },
      });

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // WHEN
      const result = await client.publish("testPublisher", { id: "123" });

      // THEN
      expect(result).toEqual(Result.Ok(true));
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.key",
        { id: "123" },
        undefined,
      );
    });

    it("should pass publish options to channel.publish", async () => {
      // GIVEN
      const TestMessage = defineMessage(z.object({ id: z.string() }));
      const testExchange = defineExchange("test-exchange", "topic");

      const contract = defineContract({
        exchanges: {
          test: testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, TestMessage, {
            routingKey: "test.key",
          }),
        },
      });

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // WHEN
      const result = await client.publish("testPublisher", { id: "123" }, { persistent: true });

      // THEN
      expect(result).toEqual(Result.Ok(true));
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.key",
        { id: "123" },
        { persistent: true },
      );
    });

    it("should return error on invalid data", async () => {
      // GIVEN
      const TestMessage = defineMessage(z.object({ id: z.string() }));
      const testExchange = defineExchange("test-exchange", "topic");

      const contract = defineContract({
        exchanges: {
          test: testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, TestMessage, {
            routingKey: "test.key",
          }),
        },
      });

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // WHEN
      // @ts-expect-error - testing runtime validation with invalid data
      const result = await client.publish("testPublisher", { id: 123 });

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

      // Create a mock close function for AmqpClient
      const mockAmqpClientClose = vi.fn().mockResolvedValue(undefined);

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // Replace the close method with our mock
      // @ts-expect-error - accessing private field for testing
      client.amqpClient.close = mockAmqpClientClose;

      // WHEN
      const result = await client.close();

      // THEN
      expect(result.isOk()).toBe(true);
      expect(mockAmqpClientClose).toHaveBeenCalled();
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

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      expect(clientResult.isOk()).toBe(true);
      const client = clientResult.get();

      // WHEN
      const result = await client.close();

      // THEN
      expect(result.isOk()).toBe(true);
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
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: ["amqp://localhost"],
      });

      // THEN
      expect(clientResult).toEqual(Result.Ok(expect.any(TypedAmqpClient)));

      expect(mockConnection.createChannel).toHaveBeenCalled();
    });
  });
});
