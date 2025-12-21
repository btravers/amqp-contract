import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineContract, defineExchange, definePublisher } from "@amqp-contract/contract";
import { z } from "zod";
import { TypedAmqpClient } from "@amqp-contract/client";
import { Result } from "@swan-io/boxed";
import { AmqpClientService } from "./client.service.js";

describe("AmqpClientService", () => {
  const mockClient = {
    publish: vi.fn(),
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TypedAmqpClient, "create").mockResolvedValue(
      mockClient as unknown as TypedAmqpClient<never>,
    );
    (mockClient.publish as ReturnType<typeof vi.fn>).mockReturnValue(Result.Ok(true));
  });

  describe("lifecycle", () => {
    it("should initialize client on module init", async () => {
      const contract = defineContract({
        exchanges: {
          testExchange: defineExchange("test-exchange", "topic", { durable: true }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", z.object({ message: z.string() }), {
            routingKey: "test.key",
          }),
        },
      });

      const service = new AmqpClientService({
        contract,
        connection: "amqp://localhost",
      });

      await service.onModuleInit();

      expect(TypedAmqpClient.create).toHaveBeenCalledWith({
        contract,
        connection: "amqp://localhost",
      });
    });

    it("should close client on module destroy", async () => {
      const contract = defineContract({
        exchanges: {
          testExchange: defineExchange("test-exchange", "topic", { durable: true }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", z.object({ message: z.string() }), {
            routingKey: "test.key",
          }),
        },
      });

      const service = new AmqpClientService({
        contract,
        connection: "amqp://localhost",
      });

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe("publish", () => {
    it("should publish message using the client", async () => {
      const contract = defineContract({
        exchanges: {
          testExchange: defineExchange("test-exchange", "topic", { durable: true }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", z.object({ message: z.string() }), {
            routingKey: "test.key",
          }),
        },
      });

      const service = new AmqpClientService({
        contract,
        connection: "amqp://localhost",
      });

      await service.onModuleInit();

      const result = service.publish("testPublisher", { message: "Hello" });

      expect(result).toEqual(Result.Ok(true));
      expect(mockClient.publish).toHaveBeenCalled();
    });

    it("should return error if client not initialized", async () => {
      const contract = defineContract({
        exchanges: {
          testExchange: defineExchange("test-exchange", "topic", { durable: true }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", z.object({ message: z.string() }), {
            routingKey: "test.key",
          }),
        },
      });

      const service = new AmqpClientService({
        contract,
        connection: "amqp://localhost",
      });

      const result = service.publish("testPublisher", { message: "Hello" });

      expect(result).toMatchObject({
        isError: expect.any(Function),
        error: expect.objectContaining({
          message: expect.stringContaining("Client not initialized"),
        }),
      });
    });
  });
});
