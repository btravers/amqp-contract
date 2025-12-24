import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypedAmqpWorker } from "./worker";
import type { ConsumeMessage } from "amqplib";
import {
  defineContract,
  defineMessage,
  defineQueue,
  defineConsumer,
  defineExchange,
  defineQueueBinding,
  defineExchangeBinding,
} from "@amqp-contract/contract";
import { z } from "zod";

// Mock types for testing
let mockConsumeCallback: ((msg: ConsumeMessage | null) => Promise<void>) | null = null;

// Mock amqp-connection-manager - everything must be inside the factory
vi.mock("amqp-connection-manager", () => {
  const mockSetupChannel = {
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    bindExchange: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
  };

  const mockChannel = {
    consume: vi.fn().mockImplementation((_queue: string, callback) => {
      mockConsumeCallback = callback;
      return Promise.resolve({ consumerTag: "test-tag" });
    }),
    ack: vi.fn(),
    nack: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    prefetch: vi.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    createChannel: vi
      .fn()
      .mockImplementation(
        (options?: { json?: boolean; setup?: (channel: unknown) => Promise<void> }) => {
          if (options?.setup) {
            // Execute setup function asynchronously
            Promise.resolve().then(() => options.setup?.(mockSetupChannel));
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
      getMockConsumeCallback: () => mockConsumeCallback,
    },
  };
});

// Get the test helpers
const amqpMock = await import("amqp-connection-manager");
// @ts-expect-error - accessing test helper
const { mockSetupChannel, mockChannel, mockConnection } = amqpMock._test;

// Global beforeEach for all tests
beforeEach(() => {
  vi.clearAllMocks();
  mockConsumeCallback = null;
  // Explicitly reset consume mock
  mockChannel.consume.mockClear();
  mockChannel.cancel.mockClear();
  mockChannel.close.mockClear();
  mockSetupChannel.assertExchange.mockClear();
  mockSetupChannel.assertQueue.mockClear();
  mockSetupChannel.bindQueue.mockClear();
  mockSetupChannel.bindExchange.mockClear();
  mockConnection.createChannel.mockClear();
  mockConnection.close.mockClear();
});

describe("Type Inference", () => {
  it("should infer consumer names correctly", async () => {
    // GIVEN
    const TestMessage = defineMessage(z.object({ id: z.string() }));
    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    const handlers = {
      testConsumer: vi.fn().mockReturnValue(Promise.resolve()),
    };

    // WHEN
    await TypedAmqpWorker.create({
      contract,
      handlers,
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // THEN
    // Type inference test - this should compile without errors
    // Since consume is private, we verify type inference through handlers
    type HandlerKeys = keyof typeof handlers;
    const name: HandlerKeys = "testConsumer";
    expect(name).toBe("testConsumer");
  });

  it("should infer handler message types correctly", async () => {
    // GIVEN
    const OrderMessage = defineMessage(
      z.object({
        orderId: z.string(),
        amount: z.number(),
      }),
    );

    const ordersQueue = defineQueue("orders");

    const contract = defineContract({
      queues: {
        orders: ordersQueue,
      },
      consumers: {
        processOrder: defineConsumer(ordersQueue, OrderMessage),
      },
    });

    const handler = vi.fn().mockReturnValue(Promise.resolve());
    await TypedAmqpWorker.create({
      contract,
      handlers: { processOrder: handler },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // WHEN
    // Simulate message
    const mockMessage = {
      content: Buffer.from(JSON.stringify({ orderId: "123", amount: 100 })),
      fields: {},
      properties: {},
    } as ConsumeMessage;

    await mockConsumeCallback?.(mockMessage);

    // THEN
    // Type inference test - handler should receive correctly typed message
    expect(handler).toHaveBeenCalledWith({
      orderId: "123",
      amount: 100,
    });
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
      consumers: {},
    });

    // WHEN
    await TypedAmqpWorker.create({
      contract,
      handlers: {},
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // Wait for async setup
    await new Promise((resolve) => setTimeout(resolve, 10));

    // THEN
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
      consumers: {},
    });

    // WHEN
    await TypedAmqpWorker.create({
      contract,
      handlers: {},
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // Wait for async setup
    await new Promise((resolve) => setTimeout(resolve, 10));

    // THEN
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
      consumers: {},
    });

    // WHEN
    await TypedAmqpWorker.create({
      contract,
      handlers: {},
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // Wait for async setup
    await new Promise((resolve) => setTimeout(resolve, 10));

    // THEN
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
      consumers: {},
    });

    // WHEN
    await TypedAmqpWorker.create({
      contract,
      handlers: {},
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // Wait for async setup
    await new Promise((resolve) => setTimeout(resolve, 10));

    // THEN
    expect(mockSetupChannel.bindExchange).toHaveBeenCalledWith(
      "destination-exchange",
      "source-exchange",
      "test.*",
      undefined,
    );
  });
});

describe("consume", () => {
  it("should setup consumer and process messages", async () => {
    // GIVEN
    const TestMessage = defineMessage(z.object({ id: z.string() }));
    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        test: testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    const handler = vi.fn().mockReturnValue(Promise.resolve());
    await TypedAmqpWorker.create({
      contract,
      handlers: { testConsumer: handler },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // THEN
    expect(mockChannel.consume).toHaveBeenCalledWith("test-queue", expect.any(Function));

    // Simulate message
    const mockMessage = {
      content: Buffer.from(JSON.stringify({ id: "123" })),
      fields: {},
      properties: {},
    } as ConsumeMessage;

    await mockConsumeCallback?.(mockMessage);

    expect(handler).toHaveBeenCalledWith({ id: "123" });
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
  });

  it("should nack invalid messages", async () => {
    // GIVEN
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const TestMessage = defineMessage(z.object({ id: z.string() }));

    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        test: testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    const handler = vi.fn().mockReturnValue(Promise.resolve());
    await TypedAmqpWorker.create({
      contract,
      handlers: { testConsumer: handler },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // WHEN
    // Simulate invalid message
    const mockMessage = {
      content: Buffer.from(JSON.stringify({ id: 123 })), // Invalid: id should be string
      fields: {},
      properties: {},
    } as ConsumeMessage;

    await mockConsumeCallback?.(mockMessage);

    // THEN
    expect(handler).not.toHaveBeenCalled();
    expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should nack and requeue on handler error", async () => {
    // GIVEN
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const TestMessage = defineMessage(z.object({ id: z.string() }));

    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        test: testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    const handler = vi.fn().mockRejectedValue(new Error("Handler error"));
    await TypedAmqpWorker.create({
      contract,
      handlers: { testConsumer: handler },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // WHEN
    // Simulate message
    const mockMessage = {
      content: Buffer.from(JSON.stringify({ id: "123" })),
      fields: {},
      properties: {},
    } as ConsumeMessage;

    await mockConsumeCallback?.(mockMessage);

    // THEN
    expect(handler).toHaveBeenCalled();
    expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should handle null messages", async () => {
    // GIVEN
    const TestMessage = defineMessage(z.object({ id: z.string() }));

    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        test: testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    const handler = vi.fn().mockReturnValue(Promise.resolve());
    await TypedAmqpWorker.create({
      contract,
      handlers: { testConsumer: handler },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // WHEN
    await mockConsumeCallback?.(null);

    // THEN
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("consumeAll", () => {
  it("should consume all consumers automatically on TypedAmqpWorker.create", async () => {
    // GIVEN
    const TestMessage = defineMessage(z.object({ id: z.string() }));
    const queue1 = defineQueue("queue1");
    const queue2 = defineQueue("queue2");

    const contract = defineContract({
      queues: {
        queue1,
        queue2,
      },
      consumers: {
        consumer1: defineConsumer(queue1, TestMessage),
        consumer2: defineConsumer(queue2, TestMessage),
      },
    });

    // WHEN
    await TypedAmqpWorker.create({
      contract,
      handlers: {
        consumer1: vi.fn().mockReturnValue(Promise.resolve()),
        consumer2: vi.fn().mockReturnValue(Promise.resolve()),
      },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // THEN
    expect(mockChannel.consume).toHaveBeenCalledTimes(2);
  });

  it("should throw error when no consumers defined", async () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        test: {
          name: "test-queue",
        },
      },
    });

    // WHEN / THEN
    await expect(
      TypedAmqpWorker.create({
        contract,
        handlers: {},
        urls: ["amqp://localhost"],
      }).resultToPromise(),
    ).rejects.toThrow("No consumers defined in contract");
  });
});

describe("close", () => {
  it("should stop consuming and close channel and connection", async () => {
    // GIVEN
    const TestMessage = defineMessage(z.object({ id: z.string() }));

    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        test: testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: { testConsumer: vi.fn().mockReturnValue(Promise.resolve()) },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // WHEN
    const result = await worker.close();

    // THEN
    expect(result.isOk()).toBe(true);
    expect(mockConnection.close).toHaveBeenCalled();
  });
});

describe("TypedAmqpWorker.create", () => {
  it("should create a worker instance, connect and consumeAll automatically", async () => {
    // GIVEN
    const TestMessage = defineMessage(z.object({ id: z.string() }));

    const testQueue = defineQueue("test-queue");

    const contract = defineContract({
      queues: {
        test: testQueue,
      },
      consumers: {
        testConsumer: defineConsumer(testQueue, TestMessage),
      },
    });

    // WHEN
    const worker = await TypedAmqpWorker.create({
      contract,
      handlers: { testConsumer: vi.fn().mockReturnValue(Promise.resolve()) },
      urls: ["amqp://localhost"],
    }).resultToPromise();

    // THEN
    expect(worker).toBeInstanceOf(TypedAmqpWorker);
    expect(mockChannel.consume).toHaveBeenCalled();
  });
});
