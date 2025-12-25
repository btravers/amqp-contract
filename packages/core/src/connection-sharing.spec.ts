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

  const mockConnection = {
    createChannel: vi.fn((options: { setup: (channel: Channel) => Promise<void> }) => {
      setupCallbacks.push(options.setup);
      return { ...mockChannel };
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };

  return {
    default: {
      connect: vi.fn(() => mockConnection),
    },
    __getMockConnection: () => mockConnection,
    __getSetupCallbacks: () => setupCallbacks,
    __getMockChannel: () => mockChannel,
    __resetCallbacks: () => {
      setupCallbacks = [];
    },
  };
});

describe("AmqpClient Connection Sharing", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const amqpModule = await import("amqp-connection-manager");
    (
      amqpModule as unknown as {
        __resetCallbacks: () => void;
      }
    ).__resetCallbacks();
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

  it("should create client from shared connection", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const primaryClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const sharedConnection = primaryClient.getConnection();

    // WHEN
    const secondaryClient = AmqpClient.fromConnection(contract, sharedConnection);

    // THEN
    expect(secondaryClient).toBeDefined();
    expect(secondaryClient.channel).toBeDefined();
    expect(secondaryClient.getConnection()).toBe(sharedConnection);
  });

  it("should create separate channels for each client sharing a connection", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const primaryClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const sharedConnection = primaryClient.getConnection();
    const amqpModule = await import("amqp-connection-manager");
    const mockConnection = (
      amqpModule as unknown as {
        __getMockConnection: () => { createChannel: { mock: { calls: unknown[][] } } };
      }
    ).__getMockConnection();

    // WHEN
    const secondaryClient = AmqpClient.fromConnection(contract, sharedConnection);

    // THEN
    // Verify that createChannel was called twice (once for each client)
    expect(mockConnection.createChannel.mock.calls.length).toBe(2);
    expect(primaryClient.channel).not.toBe(secondaryClient.channel);
  });

  it("should only close connection when primary client closes", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const primaryClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const sharedConnection = primaryClient.getConnection();
    const secondaryClient = AmqpClient.fromConnection(contract, sharedConnection);

    const amqpModule = await import("amqp-connection-manager");
    const mockConnection = (
      amqpModule as unknown as {
        __getMockConnection: () => { close: { mock: { calls: unknown[][] } } };
      }
    ).__getMockConnection();

    // WHEN - Close secondary client first
    await secondaryClient.close();

    // THEN - Connection should not be closed yet
    expect(mockConnection.close.mock.calls.length).toBe(0);

    // WHEN - Close primary client
    await primaryClient.close();

    // THEN - Connection should now be closed
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

    const primaryClient = new AmqpClient(contract1, {
      urls: ["amqp://localhost"],
    });

    const sharedConnection = primaryClient.getConnection();
    void AmqpClient.fromConnection(contract2, sharedConnection);

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
});
