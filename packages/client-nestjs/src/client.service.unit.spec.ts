import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChannelModel } from "amqplib";
import { defineContract, defineExchange, definePublisher } from "@amqp-contract/contract";
import { z } from "zod";
import { AmqpClientService } from "./client.service.js";

describe("AmqpClientService", () => {
  const mockConnection = {
    createChannel: vi.fn(),
  } as unknown as ChannelModel;

  const mockChannel = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    publish: vi.fn(),
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockConnection.createChannel as ReturnType<typeof vi.fn>).mockResolvedValue(mockChannel);
    (mockChannel.publish as ReturnType<typeof vi.fn>).mockReturnValue(true);
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
        connection: mockConnection,
      });

      await service.onModuleInit();

      expect(mockConnection.createChannel).toHaveBeenCalled();
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
        connection: mockConnection,
      });

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
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
        connection: mockConnection,
      });

      await service.onModuleInit();

      const result = await service.publish("testPublisher", { message: "Hello" });

      expect(result).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalled();
    });

    it("should throw error if client not initialized", async () => {
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
        connection: mockConnection,
      });

      await expect(service.publish("testPublisher", { message: "Hello" })).rejects.toThrow(
        "Client not initialized",
      );
    });
  });
});
