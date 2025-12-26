import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
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

  let setupCallback: ((channel: Channel) => Promise<void>) | undefined;

  return {
    default: {
      connect: vi.fn(() => ({
        createChannel: vi.fn((options: { setup: (channel: Channel) => Promise<void> }) => {
          setupCallback = options.setup;
          return mockChannel;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      })),
    },
    // Export a way to trigger setup for testing
    __getSetupCallback: () => setupCallback,
    __getMockChannel: () => mockChannel,
  };
});

describe("AmqpClient", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the singleton cache between tests
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it("should create AmqpClient with contract and options", () => {
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
  });

  it("should setup exchanges from contract", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
        notifications: defineExchange("notifications", "fanout", { autoDelete: true }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    // Get the setup callback and mock channel
    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    // Trigger setup
    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledTimes(2);
    expect(mockChannel.assertExchange).toHaveBeenNthCalledWith(1, "orders", "topic", {
      durable: true,
      autoDelete: undefined,
      internal: undefined,
      arguments: undefined,
    });
    expect(mockChannel.assertExchange).toHaveBeenNthCalledWith(2, "notifications", "fanout", {
      durable: undefined,
      autoDelete: true,
      internal: undefined,
      arguments: undefined,
    });
  });

  it("should setup queues from contract", async () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orderProcessing: defineQueue("order-processing", { durable: true }),
        notifications: defineQueue("notifications", { exclusive: true, autoDelete: true }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2);
    expect(mockChannel.assertQueue).toHaveBeenNthCalledWith(1, "order-processing", {
      durable: true,
      exclusive: undefined,
      autoDelete: undefined,
      arguments: undefined,
    });
    expect(mockChannel.assertQueue).toHaveBeenNthCalledWith(2, "notifications", {
      durable: undefined,
      exclusive: true,
      autoDelete: true,
      arguments: undefined,
    });
  });

  it("should setup queue bindings from contract", async () => {
    // GIVEN
    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const orderQueue = defineQueue("order-processing", { durable: true });
    const contract = defineContract({
      exchanges: {
        orders: ordersExchange,
      },
      queues: {
        orderProcessing: orderQueue,
      },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.created",
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.bindQueue).toHaveBeenCalledTimes(1);
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      "order-processing",
      "orders",
      "order.created",
      undefined,
    );
  });

  it("should setup exchange bindings from contract", async () => {
    // GIVEN
    const sourceExchange = defineExchange("source", "topic", { durable: true });
    const destExchange = defineExchange("destination", "topic", { durable: true });
    const contract = defineContract({
      exchanges: {
        source: sourceExchange,
        destination: destExchange,
      },
      bindings: {
        exchangeBinding: defineExchangeBinding(destExchange, sourceExchange, {
          routingKey: "*.important",
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.bindExchange).toHaveBeenCalledTimes(1);
    expect(mockChannel.bindExchange).toHaveBeenCalledWith(
      "destination",
      "source",
      "*.important",
      undefined,
    );
  });

  it("should setup complete contract with all resources", async () => {
    // GIVEN
    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const analyticsExchange = defineExchange("analytics", "fanout");
    const orderQueue = defineQueue("order-processing", { durable: true });
    const analyticsQueue = defineQueue("analytics-processing");

    const contract = defineContract({
      exchanges: {
        orders: ordersExchange,
        analytics: analyticsExchange,
      },
      queues: {
        orderProcessing: orderQueue,
        analyticsProcessing: analyticsQueue,
      },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.#",
        }),
        analyticsBinding: defineQueueBinding(analyticsQueue, analyticsExchange),
        exchangeBinding: defineExchangeBinding(analyticsExchange, ordersExchange, {
          routingKey: "order.created",
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledTimes(2);
    expect(mockChannel.assertQueue).toHaveBeenCalledTimes(2);
    expect(mockChannel.bindQueue).toHaveBeenCalledTimes(2);
    expect(mockChannel.bindExchange).toHaveBeenCalledTimes(1);
  });

  it("should handle empty contract", async () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.assertExchange).not.toHaveBeenCalled();
    expect(mockChannel.assertQueue).not.toHaveBeenCalled();
    expect(mockChannel.bindQueue).not.toHaveBeenCalled();
    expect(mockChannel.bindExchange).not.toHaveBeenCalled();
  });

  it("should handle fanout exchange binding without routing key", async () => {
    // GIVEN
    const fanoutExchange = defineExchange("fanout", "fanout");
    const orderQueue = defineQueue("order-queue");
    const contract = defineContract({
      exchanges: {
        fanout: fanoutExchange,
      },
      queues: {
        orderQueue: orderQueue,
      },
      bindings: {
        fanoutBinding: defineQueueBinding(orderQueue, fanoutExchange),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.bindQueue).toHaveBeenCalledWith("order-queue", "fanout", "", undefined);
  });

  it("should pass custom arguments to exchanges", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", {
          durable: true,
          arguments: { "x-custom": "value" },
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.assertExchange).toHaveBeenCalledWith("orders", "topic", {
      durable: true,
      autoDelete: undefined,
      internal: undefined,
      arguments: { "x-custom": "value" },
    });
  });

  it("should pass custom arguments to queues", async () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orders: defineQueue("orders", {
          durable: true,
          arguments: { "x-max-length": 1000 },
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.assertQueue).toHaveBeenCalledWith("orders", {
      durable: true,
      exclusive: undefined,
      autoDelete: undefined,
      arguments: { "x-max-length": 1000 },
    });
  });

  it("should pass custom arguments to bindings", async () => {
    // GIVEN
    const exchange = defineExchange("orders", "topic");
    const queue = defineQueue("orders");
    const contract = defineContract({
      exchanges: { orders: exchange },
      queues: { orders: queue },
      bindings: {
        orderBinding: defineQueueBinding(queue, exchange, {
          routingKey: "order.#",
          arguments: { "x-match": "all" },
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await setupCallback(mockChannel);

    // THEN
    expect(mockChannel.bindQueue).toHaveBeenCalledWith("orders", "orders", "order.#", {
      "x-match": "all",
    });
  });

  it("should throw AggregateError when exchange setup fails", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
        notifications: defineExchange("notifications", "fanout"),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    // Mock one exchange to fail
    (mockChannel.assertExchange as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Exchange setup failed"),
    );

    // THEN
    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await expect(setupCallback(mockChannel)).rejects.toThrow("Failed to setup exchanges");
  });

  it("should throw AggregateError when queue setup fails", async () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orders: defineQueue("orders", { durable: true }),
        notifications: defineQueue("notifications"),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    // Mock one queue to fail
    (mockChannel.assertQueue as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Queue setup failed"),
    );

    // THEN
    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await expect(setupCallback(mockChannel)).rejects.toThrow("Failed to setup queues");
  });

  it("should throw AggregateError when binding setup fails", async () => {
    // GIVEN
    const exchange = defineExchange("orders", "topic");
    const queue = defineQueue("orders");
    const contract = defineContract({
      exchanges: { orders: exchange },
      queues: { orders: queue },
      bindings: {
        orderBinding: defineQueueBinding(queue, exchange, {
          routingKey: "order.#",
        }),
      },
    });

    // WHEN
    void new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const setupCallback = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getSetupCallback();
    const mockChannel = (
      amqpModule as unknown as {
        __getSetupCallback: () => ((channel: Channel) => Promise<void>) | undefined;
        __getMockChannel: () => Channel;
      }
    ).__getMockChannel();

    // Mock binding to fail
    (mockChannel.bindQueue as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Binding setup failed"),
    );

    // THEN
    if (!setupCallback) {
      throw new Error("Setup callback not found");
    }
    await expect(setupCallback(mockChannel)).rejects.toThrow("Failed to setup bindings");
  });

  it("should close channel and connection when last client closes (reference counting)", async () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    const client = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const amqpModule = await import("amqp-connection-manager");
    const mockConnection = (
      amqpModule.default as unknown as {
        connect: { mock: { results: Array<{ value: { close: () => Promise<void> } }> } };
      }
    ).connect.mock.results[0]?.value;

    const mockChannel = (
      amqpModule as unknown as { __getMockChannel: () => { close: () => Promise<void> } }
    ).__getMockChannel();

    if (!mockConnection) {
      throw new Error("Mock connection not found");
    }

    // WHEN
    await client.close();

    // THEN
    // Channel should be closed
    expect(mockChannel.close).toHaveBeenCalledTimes(1);
    // Connection should also be closed (reference count reaches 0)
    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });
});
