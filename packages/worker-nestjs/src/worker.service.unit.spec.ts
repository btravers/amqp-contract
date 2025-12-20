import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChannelModel } from "amqplib";
import { defineContract, defineQueue, defineConsumer } from "@amqp-contract/contract";
import { z } from "zod";
import { AmqpWorkerService } from "./worker.service.js";

describe("AmqpWorkerService", () => {
  const mockConnection = {
    createChannel: vi.fn(),
  } as unknown as ChannelModel;

  const mockChannel = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    consume: vi.fn(),
    prefetch: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    cancel: vi.fn(),
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockConnection.createChannel as ReturnType<typeof vi.fn>).mockResolvedValue(mockChannel);
    (mockChannel.consume as ReturnType<typeof vi.fn>).mockResolvedValue({ consumerTag: "test" });
  });

  describe("lifecycle", () => {
    it("should initialize worker on module init", async () => {
      const contract = defineContract({
        queues: {
          testQueue: defineQueue("test-queue", { durable: true }),
        },
        consumers: {
          testConsumer: defineConsumer("test-queue", z.object({ message: z.string() })),
        },
      });

      const handler = vi.fn();
      const service = new AmqpWorkerService({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: mockConnection,
      });

      await service.onModuleInit();

      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(service.getWorker()).not.toBeNull();
    });

    it("should close worker on module destroy", async () => {
      const contract = defineContract({
        queues: {
          testQueue: defineQueue("test-queue", { durable: true }),
        },
        consumers: {
          testConsumer: defineConsumer("test-queue", z.object({ message: z.string() })),
        },
      });

      const handler = vi.fn();
      const service = new AmqpWorkerService({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: mockConnection,
      });

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(service.getWorker()).toBeNull();
    });
  });

  describe("getWorker", () => {
    it("should return null before initialization", () => {
      const contract = defineContract({
        queues: {
          testQueue: defineQueue("test-queue", { durable: true }),
        },
        consumers: {
          testConsumer: defineConsumer("test-queue", z.object({ message: z.string() })),
        },
      });

      const handler = vi.fn();
      const service = new AmqpWorkerService({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: mockConnection,
      });

      expect(service.getWorker()).toBeNull();
    });

    it("should return worker instance after initialization", async () => {
      const contract = defineContract({
        queues: {
          testQueue: defineQueue("test-queue", { durable: true }),
        },
        consumers: {
          testConsumer: defineConsumer("test-queue", z.object({ message: z.string() })),
        },
      });

      const handler = vi.fn();
      const service = new AmqpWorkerService({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: mockConnection,
      });

      await service.onModuleInit();

      expect(service.getWorker()).not.toBeNull();
    });
  });
});
