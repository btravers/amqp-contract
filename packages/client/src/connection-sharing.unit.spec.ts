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
  let connectCallCount = 0;

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
      connect: vi.fn().mockImplementation(() => {
        connectCallCount++;
        return mockConnection;
      }),
    },
    _test: {
      mockSetupChannel,
      mockChannel,
      mockConnection,
      getConnectCallCount: () => connectCallCount,
      resetConnectCount: () => {
        connectCallCount = 0;
      },
    },
  };
});

const amqpMock = await import("amqp-connection-manager");
// @ts-expect-error - accessing test helper
const { mockChannel } = amqpMock._test;

describe("TypedAmqpClient Connection Sharing (Singleton)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // @ts-expect-error - accessing test helper
    amqpMock._test.resetConnectCount();
    // Reset the singleton cache between tests
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it("should automatically share connection for clients with same URLs", async () => {
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

    const urls = ["amqp://localhost"];

    // WHEN - Create two clients with same URLs
    const client1Result = await TypedAmqpClient.create({
      contract,
      urls,
    });

    const client2Result = await TypedAmqpClient.create({
      contract,
      urls,
    });

    // THEN
    expect(client1Result.isOk()).toBe(true);
    expect(client2Result.isOk()).toBe(true);

    // @ts-expect-error - accessing test helper
    const connectCallCount = amqpMock._test.getConnectCallCount();
    // Connection should only be created once due to singleton
    expect(connectCallCount).toBe(1);

    if (client1Result.isOk()) {
      const client = client1Result.value;

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

  it("should create separate connections for different URLs", async () => {
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

    // WHEN - Create two clients with different URLs
    const client1Result = await TypedAmqpClient.create({
      contract,
      urls: ["amqp://localhost"],
    });

    const client2Result = await TypedAmqpClient.create({
      contract,
      urls: ["amqp://other-host"],
    });

    // THEN
    expect(client1Result.isOk()).toBe(true);
    expect(client2Result.isOk()).toBe(true);

    // @ts-expect-error - accessing test helper
    const connectCallCount = amqpMock._test.getConnectCallCount();
    // Two connections should be created for different URLs
    expect(connectCallCount).toBe(2);
  });
});
