import { Future, Result } from "@swan-io/boxed";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
} from "@amqp-contract/contract";
import { AmqpClientService } from "./client.service.js";
import { TypedAmqpClient } from "@amqp-contract/client";
import { TechnicalError } from "@amqp-contract/core";
import { z } from "zod";

const testExchange = defineExchange("test-exchange", "topic", { durable: true });
const testMessage = defineMessage(z.object({ message: z.string() }));

const contract = defineContract({
  publishers: {
    testPublisher: definePublisher(testExchange, testMessage, {
      routingKey: "test.key",
    }),
  },
});

describe("AmqpClientService", () => {
  const mockPublish = vi.fn();
  const mockClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockPublish.mockReturnValue(Future.value(Result.Ok(undefined)));
    mockClose.mockReturnValue(Future.value(Result.Ok(undefined)));
  });

  function mockCreateSuccess() {
    vi.spyOn(TypedAmqpClient, "create").mockReturnValue(
      Future.value(
        Result.Ok({ publish: mockPublish, close: mockClose } as unknown as TypedAmqpClient<never>),
      ),
    );
  }

  function createService() {
    return new AmqpClientService({ contract, urls: ["amqp://localhost"] });
  }

  describe("publish before initialization", () => {
    it("should return a TechnicalError", async () => {
      const service = createService();

      const result = await service.publish("testPublisher", { message: "Hello" });

      expect(result.isError()).toBe(true);
      result.match({
        Ok: () => expect.unreachable("Expected Error result"),
        Error: (error) => expect(error).toBeInstanceOf(TechnicalError),
      });
    });
  });

  describe("lifecycle: init → publish → destroy", () => {
    it("should delegate publish to the underlying client after init", async () => {
      mockCreateSuccess();
      const service = createService();

      await service.onModuleInit();
      await service.publish("testPublisher", { message: "Hello" });

      expect(mockPublish).toHaveBeenCalledWith("testPublisher", { message: "Hello" }, undefined);
    });

    it("should close the client on module destroy", async () => {
      mockCreateSuccess();
      const service = createService();

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockClose).toHaveBeenCalledOnce();
    });

    it("should return error when publishing after destroy", async () => {
      mockCreateSuccess();
      const service = createService();

      await service.onModuleInit();
      await service.onModuleDestroy();
      const result = await service.publish("testPublisher", { message: "Hello" });

      expect(result.isError()).toBe(true);
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
      vi.spyOn(TypedAmqpClient, "create").mockReturnValue(
        Future.value(Result.Error(new TechnicalError("Connection refused"))),
      );
      const service = createService();

      await expect(service.onModuleInit()).rejects.toThrow("Connection refused");
    });
  });
});
