import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  defineConsumer,
} from "@amqp-contract/contract";
import { TypedAmqpClient } from "@amqp-contract/client";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { AmqpClient } from "@amqp-contract/core";
import { z } from "zod";

vi.mock("amqp-connection-manager", () => {
  const mockSetupChannel = {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    bindExchange: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue(undefined),
  };

  let setupPromise: Promise<void> | null = null;

  const mockChannel = {
    publish: vi.fn().mockImplementation(() => Promise.resolve(true)),
    consume: vi.fn().mockResolvedValue(undefined),
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
const { mockChannel, mockConnection } = amqpMock._test;

describe("Client and Worker Connection Sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow client and worker to share connection", async () => {
    // GIVEN
    const orderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      })
    );

    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const orderQueue = defineQueue("order-processing", { durable: true });

    const contract = defineContract({
      exchanges: { orders: ordersExchange },
      queues: { orderProcessing: orderQueue },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.created",
        }),
      },
      publishers: {
        orderCreated: definePublisher(ordersExchange, orderMessage, {
          routingKey: "order.created",
        }),
      },
      consumers: {
        processOrder: defineConsumer(orderQueue, orderMessage),
      },
    });

    // Create a shared AmqpClient
    const sharedAmqpClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    // WHEN - Create client and worker with shared connection
    const clientResult = await TypedAmqpClient.create({
      contract,
      amqpClient: sharedAmqpClient,
    });

    const workerResult = await TypedAmqpWorker.create({
      contract,
      amqpClient: sharedAmqpClient,
      handlers: {
        processOrder: vi.fn(),
      },
    });

    // THEN
    expect(clientResult.isOk()).toBe(true);
    expect(workerResult.isOk()).toBe(true);

    // Verify connection.createChannel was called for both client and worker
    // (one for the shared AmqpClient, one for the client, one for the worker)
    expect(mockConnection.createChannel.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("should create separate connections when not sharing", async () => {
    // GIVEN
    const orderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      })
    );

    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const orderQueue = defineQueue("order-processing", { durable: true });

    const contract = defineContract({
      exchanges: { orders: ordersExchange },
      queues: { orderProcessing: orderQueue },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.created",
        }),
      },
      publishers: {
        orderCreated: definePublisher(ordersExchange, orderMessage, {
          routingKey: "order.created",
        }),
      },
      consumers: {
        processOrder: defineConsumer(orderQueue, orderMessage),
      },
    });

    // Get initial mock state
    const amqpModule = await import("amqp-connection-manager");
    const connectSpy = amqpModule.default.connect as ReturnType<typeof vi.fn>;
    const initialConnectCount = connectSpy.mock.calls.length;

    // WHEN - Create client and worker without shared connection
    const clientResult = await TypedAmqpClient.create({
      contract,
      urls: ["amqp://localhost"],
    });

    const workerResult = await TypedAmqpWorker.create({
      contract,
      urls: ["amqp://localhost"],
      handlers: {
        processOrder: vi.fn(),
      },
    });

    // THEN
    expect(clientResult.isOk()).toBe(true);
    expect(workerResult.isOk()).toBe(true);

    // Verify connect was called twice (once for each)
    expect(connectSpy.mock.calls.length).toBe(initialConnectCount + 2);
  });

  it("should allow client to publish and worker to consume with shared connection", async () => {
    // GIVEN
    const orderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      })
    );

    const ordersExchange = defineExchange("orders", "topic", { durable: true });
    const orderQueue = defineQueue("order-processing", { durable: true });

    const contract = defineContract({
      exchanges: { orders: ordersExchange },
      queues: { orderProcessing: orderQueue },
      bindings: {
        orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
          routingKey: "order.created",
        }),
      },
      publishers: {
        orderCreated: definePublisher(ordersExchange, orderMessage, {
          routingKey: "order.created",
        }),
      },
      consumers: {
        processOrder: defineConsumer(orderQueue, orderMessage),
      },
    });

    const sharedAmqpClient = new AmqpClient(contract, {
      urls: ["amqp://localhost"],
    });

    const clientResult = await TypedAmqpClient.create({
      contract,
      amqpClient: sharedAmqpClient,
    });

    const handlerMock = vi.fn();
    const workerResult = await TypedAmqpWorker.create({
      contract,
      amqpClient: sharedAmqpClient,
      handlers: {
        processOrder: handlerMock,
      },
    });

    if (clientResult.isError() || workerResult.isError()) {
      throw new Error("Failed to create client or worker");
    }

    const client = clientResult.value;
    const worker = workerResult.value;

    // WHEN - Publish a message
    const publishResult = await client.publish("orderCreated", {
      orderId: "ORD-123",
      amount: 99.99,
    });

    // THEN
    expect(publishResult.isOk()).toBe(true);
    expect(mockChannel.publish).toHaveBeenCalledWith(
      "orders",
      "order.created",
      { orderId: "ORD-123", amount: 99.99 },
      undefined
    );

    // Verify worker started consuming
    expect(mockChannel.consume).toHaveBeenCalledWith(
      "order-processing",
      expect.any(Function)
    );
  });
});
