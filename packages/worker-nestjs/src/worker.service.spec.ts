import { Future, Result } from "@swan-io/boxed";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineConsumer,
  defineContract,
  defineMessage,
  defineQueue,
} from "@amqp-contract/contract";
import { AmqpWorkerService } from "./worker.service.js";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { z } from "zod";

describe("AmqpWorkerService", () => {
  const mockWorker = {
    close: vi.fn().mockReturnValue(Future.value(Result.Ok(undefined))),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TypedAmqpWorker, "create").mockReturnValue(
      Future.value(Result.Ok(mockWorker as unknown as TypedAmqpWorker<never>)),
    );
  });

  describe("initialization", () => {
    it("should pass configuration to TypedAmqpWorker.create", async () => {
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
  });
});
