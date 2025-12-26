/* eslint-disable sort-imports */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
} from "@amqp-contract/contract";
import { AmqpClient } from "@amqp-contract/core";
import { z } from "zod";
import { TypedAmqpClient } from "./client.js";

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
    _test: {
      mockSetupChannel,
      mockChannel,
      mockConnection,
    },
  };
});

const amqpMock = await import("amqp-connection-manager");
// @ts-expect-error - accessing test helper
const { mockChannel } = amqpMock._test;

describe("TypedAmqpClient Connection Sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow creating client with shared connection", async () => {
    // GIVEN
    const orderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
    );

    const ordersExchange = defineExchange("orders", "topic", { durable: true });

    const contract = defineContract({
      exchanges: { orders: ordersExchange },
      publishers: {
        orderCreated: definePublisher(ordersExchange, orderMessage, {
          routingKey: "order.created",
        }),
      },
    });

    // Create a primary AmqpClient to get the connection
    const primaryAmqpClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });
    const sharedConnection = primaryAmqpClient.getConnection();

    // WHEN - Create client with shared connection
    const clientResult = await TypedAmqpClient.create({
      contract,
      connection: sharedConnection,
    });

    // THEN
    expect(clientResult.isOk()).toBe(true);
    if (clientResult.isOk()) {
      const client = clientResult.value;

      // Publish a message to verify it works
      const publishResult = await client.publish("orderCreated", {
        orderId: "ORD-123",
        amount: 99.99,
      });

      expect(publishResult.isOk()).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "orders",
        "order.created",
        { orderId: "ORD-123", amount: 99.99 },
        undefined,
      );
    }
  });

  it("should create separate clients sharing same connection", async () => {
    // GIVEN
    const orderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
    );

    const ordersExchange = defineExchange("orders", "topic", { durable: true });

    const contract = defineContract({
      exchanges: { orders: ordersExchange },
      publishers: {
        orderCreated: definePublisher(ordersExchange, orderMessage, {
          routingKey: "order.created",
        }),
      },
    });

    // Create a primary AmqpClient to get the connection
    const primaryAmqpClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });
    const sharedConnection = primaryAmqpClient.getConnection();

    // WHEN - Create two clients with shared connection
    const client1Result = await TypedAmqpClient.create({
      contract,
      connection: sharedConnection,
    });

    const client2Result = await TypedAmqpClient.create({
      contract,
      connection: sharedConnection,
    });

    // THEN
    expect(client1Result.isOk()).toBe(true);
    expect(client2Result.isOk()).toBe(true);

    // Verify both clients can publish
    if (client1Result.isOk() && client2Result.isOk()) {
      const client1 = client1Result.value;
      const client2 = client2Result.value;

      await client1.publish("orderCreated", {
        orderId: "ORD-1",
        amount: 50.0,
      });

      await client2.publish("orderCreated", {
        orderId: "ORD-2",
        amount: 75.0,
      });

      expect(mockChannel.publish).toHaveBeenCalledTimes(2);
    }
  });

  it("should create separate connections when not sharing", async () => {
    // GIVEN
    const orderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
    );

    const ordersExchange = defineExchange("orders", "topic", { durable: true });

    const contract = defineContract({
      exchanges: { orders: ordersExchange },
      publishers: {
        orderCreated: definePublisher(ordersExchange, orderMessage, {
          routingKey: "order.created",
        }),
      },
    });

    // Get initial mock state
    const amqpModule = await import("amqp-connection-manager");
    const connectSpy = amqpModule.default.connect as ReturnType<typeof vi.fn>;
    const initialConnectCount = connectSpy.mock.calls.length;

    // WHEN - Create two clients without shared connection
    const client1Result = await TypedAmqpClient.create({
      contract,
      urls: ["amqp://localhost"],
    });

    const client2Result = await TypedAmqpClient.create({
      contract,
      urls: ["amqp://localhost"],
    });

    // THEN
    expect(client1Result.isOk()).toBe(true);
    expect(client2Result.isOk()).toBe(true);

    // Verify connect was called twice (once for each)
    expect(connectSpy.mock.calls.length).toBe(initialConnectCount + 2);
  });
});
