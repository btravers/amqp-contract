import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedAmqpClient } from "./client";
import type { Channel, ChannelModel } from "amqplib";
import { connect } from "amqplib";
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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // THEN
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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // WHEN
      // Type inference test - message type should be inferred correctly
      await client
        .publish("createOrder", {
          orderId: "123",
          amount: 100,
        })
        .toPromise();

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
      const clientResult = await TypedAmqpClient.create({
        contract,
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }

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
      const clientResult = await TypedAmqpClient.create({
        contract,
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }

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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }

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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }

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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // WHEN
      const result = await client.publish("testPublisher", { id: "123" }).toPromise();

      // THEN
      expect(result).toEqual(Result.Ok(true));
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.key",
        Buffer.from(JSON.stringify({ id: "123" })),
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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // WHEN
      const result = await client
        .publish("testPublisher", { id: "123" }, { persistent: true })
        .toPromise();

      // THEN
      expect(result).toEqual(Result.Ok(true));
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "test-exchange",
        "test.key",
        expect.any(Buffer),
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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // WHEN
      // @ts-expect-error - testing runtime validation with invalid data
      const result = await client.publish("testPublisher", { id: 123 }).toPromise();

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

      const clientResult = await TypedAmqpClient.create({
        contract,
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // WHEN
      const result = await client.close().toPromise();

      // THEN
      expect(result.isOk()).toBe(true);
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

      const clientResult = await TypedAmqpClient.create({
        contract,
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // WHEN
      const result = await client.close().toPromise();

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
        connection: "amqp://localhost",
      }).toPromise();
      if (clientResult.isError()) {
        throw clientResult.getError();
      }
      const client = clientResult.value;

      // THEN
      expect(client).toBeInstanceOf(TypedAmqpClient);
      expect(mockConnection.createChannel).toHaveBeenCalled();
    });
  });
});
