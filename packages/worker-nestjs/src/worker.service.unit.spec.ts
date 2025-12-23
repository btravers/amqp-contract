import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  defineContract,
  defineQueue,
  defineConsumer,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { AmqpWorkerService } from "./worker.service.js";
import { Future, Result } from "@swan-io/boxed";

describe("AmqpWorkerService", () => {
  const mockWorker = {
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TypedAmqpWorker, "create").mockReturnValue(
      Future.value(Result.Ok(mockWorker as unknown as TypedAmqpWorker<never>)),
    );
  });

  describe("lifecycle", () => {
    it("should initialize worker on module init", async () => {
      const testQueue = defineQueue("test-queue", { durable: true });
      const testMessage = defineMessage(z.object({ message: z.string() }));

      const contract = defineContract({
        queues: {
          testQueue,
        },
        consumers: {
          testConsumer: defineConsumer(testQueue, testMessage),
        },
      });

      const handler = vi.fn();
      const service = new AmqpWorkerService({
        contract,
        handlers: {
          testConsumer: handler,
        },
        urls: ["amqp://localhost"],
      });

      await service.onModuleInit();

      expect(TypedAmqpWorker.create).toHaveBeenCalledWith({
        contract,
        handlers: {
          testConsumer: handler,
        },
        urls: ["amqp://localhost"],
      });
    });

    it("should close worker on module destroy", async () => {
      const testQueue = defineQueue("test-queue", { durable: true });
      const testMessage = defineMessage(z.object({ message: z.string() }));

      const contract = defineContract({
        queues: {
          testQueue,
        },
        consumers: {
          testConsumer: defineConsumer(testQueue, testMessage),
        },
      });

      const handler = vi.fn();
      const service = new AmqpWorkerService({
        contract,
        handlers: {
          testConsumer: handler,
        },
        urls: ["amqp://localhost"],
      });

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockWorker.close).toHaveBeenCalled();
    });
  });
});
