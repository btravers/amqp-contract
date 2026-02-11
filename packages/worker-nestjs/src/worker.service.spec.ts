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

const testQueue = defineQueue("test-queue", { durable: true });
const testMessage = defineMessage(z.object({ message: z.string() }));

const contract = defineContract({
  consumers: {
    testConsumer: defineConsumer(testQueue, testMessage),
  },
});

describe("AmqpWorkerService", () => {
  const mockClose = vi.fn();
  const handler = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockClose.mockReturnValue(Future.value(Result.Ok(undefined)));
  });

  function mockCreateSuccess() {
    vi.spyOn(TypedAmqpWorker, "create").mockReturnValue(
      Future.value(Result.Ok({ close: mockClose } as unknown as TypedAmqpWorker<never>)),
    );
  }

  function createService() {
    return new AmqpWorkerService({
      contract,
      handlers: { testConsumer: handler },
      urls: ["amqp://localhost"],
    });
  }

  describe("lifecycle: init → destroy", () => {
    it("should create the worker on init with the provided options", async () => {
      mockCreateSuccess();
      const service = createService();

      await service.onModuleInit();

      expect(TypedAmqpWorker.create).toHaveBeenCalledWith({
        contract,
        handlers: { testConsumer: handler },
        urls: ["amqp://localhost"],
      });
    });

    it("should close the worker on module destroy", async () => {
      mockCreateSuccess();
      const service = createService();

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockClose).toHaveBeenCalledOnce();
    });
  });

  describe("destroy without init", () => {
    it("should be a no-op", async () => {
      const service = createService();

      // Should not throw
      await service.onModuleDestroy();
    });
  });

  describe("initialization failure", () => {
    it("should propagate the error from create", async () => {
      vi.spyOn(TypedAmqpWorker, "create").mockReturnValue(
        Future.value(Result.Error(new Error("Connection refused"))),
      );
      const service = createService();

      await expect(service.onModuleInit()).rejects.toThrow("Connection refused");
    });
  });
});
