import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  defineContract,
  defineExchange,
  definePublisher,
  defineMessage,
} from "@amqp-contract/contract";
import { z } from "zod";
import { TypedAmqpClient } from "@amqp-contract/client";
import { Future, Result } from "@swan-io/boxed";
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
    (mockClient.publish as ReturnType<typeof vi.fn>).mockReturnValue(
      Future.value(Result.Ok(true)),
    );
    (mockClient.close as ReturnType<typeof vi.fn>).mockReturnValue(
      Future.value(Result.Ok(undefined)),
    );
  });

  describe("lifecycle", () => {
    it("should initialize client on module init", async () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testMessage = defineMessage(z.object({ message: z.string() }));

      const contract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, testMessage, {
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
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testMessage = defineMessage(z.object({ message: z.string() }));

      const contract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, testMessage, {
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
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testMessage = defineMessage(z.object({ message: z.string() }));

      const contract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, testMessage, {
            routingKey: "test.key",
          }),
        },
      });

      const service = new AmqpClientService({
        contract,
        connection: "amqp://localhost",
      });

      await service.onModuleInit();

      const future = service.publish("testPublisher", { message: "Hello" });
      const result = await future.toPromise();

      expect(result).toEqual(Result.Ok(true));
      expect(mockClient.publish).toHaveBeenCalled();
    });

    it("should return error if client not initialized", async () => {
      const testExchange = defineExchange("test-exchange", "topic", { durable: true });
      const testMessage = defineMessage(z.object({ message: z.string() }));

      const contract = defineContract({
        exchanges: {
          testExchange,
        },
        publishers: {
          testPublisher: definePublisher(testExchange, testMessage, {
            routingKey: "test.key",
          }),
        },
      });

      const service = new AmqpClientService({
        contract,
        connection: "amqp://localhost",
      });

      const future = service.publish("testPublisher", { message: "Hello" });
      const result = await future.toPromise();

      expect(result).toMatchObject({
        tag: "Error",
        error: expect.objectContaining({
          message: expect.stringContaining("Client not initialized"),
        }),
      });
    });
  });
});
