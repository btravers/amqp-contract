import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineContract, defineQueue, defineConsumer } from "@amqp-contract/contract";
import { z } from "zod";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { AmqpWorkerService } from "./worker.service.js";

describe("AmqpWorkerService", () => {
  const mockWorker = {
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TypedAmqpWorker, "create").mockResolvedValue(
      mockWorker as unknown as TypedAmqpWorker<never>,
    );
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
        connection: "amqp://localhost",
      });

      await service.onModuleInit();

      expect(TypedAmqpWorker.create).toHaveBeenCalledWith({
        contract,
        handlers: {
          testConsumer: handler,
        },
        connection: "amqp://localhost",
      });
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
        connection: "amqp://localhost",
      });

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalled();
    });
  });
});
