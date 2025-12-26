import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineContract, defineExchange, defineQueue } from "@amqp-contract/contract";
import { AmqpClient } from "./amqp-client.js";
import type { Channel } from "amqplib";

// Mock amqp-connection-manager
vi.mock("amqp-connection-manager", () => {
  const mockChannel = {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    bindExchange: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };

  let setupCallbacks: Array<(channel: Channel) => Promise<void>> = [];
  let connectCallCount = 0;
  const connectionsByUrl: Map<string, unknown> = new Map();

  const createMockConnection = () => ({
    createChannel: vi.fn((options: { setup: (channel: Channel) => Promise<void> }) => {
      setupCallbacks.push(options.setup);
      return { ...mockChannel };
    }),
    close: vi.fn().mockResolvedValue(undefined),
  });

  return {
    default: {
      connect: vi.fn((urls: unknown[]) => {
        connectCallCount++;
        const key = JSON.stringify(urls);
        if (!connectionsByUrl.has(key)) {
          connectionsByUrl.set(key, createMockConnection());
        }
        return connectionsByUrl.get(key);
      }),
    },
    __getMockConnection: () => Array.from(connectionsByUrl.values())[0],
    __getSetupCallbacks: () => setupCallbacks,
    __getMockChannel: () => mockChannel,
    __getConnectCallCount: () => connectCallCount,
    __resetCallbacks: () => {
      setupCallbacks = [];
    },
    __resetConnectCount: () => {
      connectCallCount = 0;
      connectionsByUrl.clear();
    },
  };
});

describe("AmqpClient Connection Sharing (Singleton)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const amqpModule = await import("amqp-connection-manager");
    (
      amqpModule as unknown as {
        __resetCallbacks: () => void;
        __resetConnectCount: () => void;
      }
    ).__resetCallbacks();
    (
      amqpModule as unknown as {
        __resetConnectCount: () => void;
      }
    ).__resetConnectCount();

    // Reset the singleton cache between tests
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it("should create client with its own connection", () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    // WHEN
    const client = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    // THEN
    expect(client).toBeDefined();
    expect(client.channel).toBeDefined();
    expect(client.getConnection()).toBeDefined();
  });

  it("should reuse connection for clients with same URLs", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const urls = ["amqp://localhost"];

    // WHEN - Create two clients with same URLs
    const primaryClient = new AmqpClient(contract, { urls });
    const secondaryClient = new AmqpClient(contract, { urls });

    const amqpModule = await import("amqp-connection-manager");
    const connectCallCount = (
      amqpModule as unknown as {
        __getConnectCallCount: () => number;
      }
    ).__getConnectCallCount();

    // THEN
    expect(primaryClient).toBeDefined();
    expect(secondaryClient).toBeDefined();
    expect(primaryClient.getConnection()).toBe(secondaryClient.getConnection());
    // Connection should only be created once due to singleton
    expect(connectCallCount).toBe(1);
  });

  it("should create separate channels for each client sharing a connection", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const urls = ["amqp://localhost"];

    // WHEN - Create two clients with same URLs
    const primaryClient = new AmqpClient(contract, { urls });
    const secondaryClient = new AmqpClient(contract, { urls });

    // THEN
    // Both clients should share the same connection
    expect(primaryClient.getConnection()).toBe(secondaryClient.getConnection());
    // But have different channels
    expect(primaryClient.channel).not.toBe(secondaryClient.channel);
  });

  it("should close shared connection when all clients are closed", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const urls = ["amqp://localhost"];
    const primaryClient = new AmqpClient(contract, { urls });
    const secondaryClient = new AmqpClient(contract, { urls });

    const amqpModule = await import("amqp-connection-manager");
    const mockConnection = (
      amqpModule as unknown as {
        __getMockConnection: () => { close: { mock: { calls: unknown[][] } } };
      }
    ).__getMockConnection();

    // WHEN - Close first client
    await primaryClient.close();

    // THEN - Connection should not be closed yet (still has reference)
    expect(mockConnection.close.mock.calls.length).toBe(0);

    // WHEN - Close second client
    await secondaryClient.close();

    // THEN - Connection should now be closed (last reference gone)
    expect(mockConnection.close.mock.calls.length).toBe(1);
  });

  it("should setup infrastructure for both clients sharing connection", async () => {
    // GIVEN
    const contract1 = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const contract2 = defineContract({
      queues: {
        notifications: defineQueue("notifications", { durable: true }),
      },
    });

    const urls = ["amqp://localhost"];
    void new AmqpClient(contract1, { urls });
    void new AmqpClient(contract2, { urls });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallbacks = (
      amqpModule as unknown as {
        __getSetupCallbacks: () => Array<(channel: Channel) => Promise<void>>;
      }
    ).__getSetupCallbacks();

    const mockChannel = (
      amqpModule as unknown as {
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    // WHEN - Trigger setup for both clients
    for (const setupCallback of setupCallbacks) {
      await setupCallback(mockChannel);
    }

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledWith("orders", "topic", {
      durable: true,
      autoDelete: undefined,
      internal: undefined,
      arguments: undefined,
    });
    expect(mockChannel.assertQueue).toHaveBeenCalledWith("notifications", {
      durable: true,
      exclusive: undefined,
      autoDelete: undefined,
      arguments: undefined,
    });
  });

  it("should create separate connections for different URLs", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const amqpModule = await import("amqp-connection-manager");

    // WHEN - Create two clients with different URLs
    const client1 = new AmqpClient(contract, { urls: ["amqp://localhost"] });
    const client2 = new AmqpClient(contract, { urls: ["amqp://other-host"] });

    const connectCallCount = (
      amqpModule as unknown as {
        __getConnectCallCount: () => number;
      }
    ).__getConnectCallCount();

    // THEN - Two connections should be created
    expect(client1.getConnection()).not.toBe(client2.getConnection());
    expect(connectCallCount).toBe(2);
  });
});
