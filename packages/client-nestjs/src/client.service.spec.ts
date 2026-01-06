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
import { z } from "zod";

describe("AmqpClientService", () => {
  const mockClient = {
    publish: vi.fn(),
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(TypedAmqpClient, "create").mockReturnValue(
      Future.value(Result.Ok(mockClient as unknown as TypedAmqpClient<never>)),
    );
    (mockClient.publish as ReturnType<typeof vi.fn>).mockReturnValue(
      Future.value(Result.Ok(undefined)),
    );
    (mockClient.close as ReturnType<typeof vi.fn>).mockReturnValue(
      Future.value(Result.Ok(undefined)),
    );
  });

  describe("publish", () => {
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
        urls: ["amqp://localhost"],
      });

      const future = service.publish("testPublisher", { message: "Hello" });
      const result = await future;

      expect(result).toMatchObject({
        tag: "Error",
        error: expect.objectContaining({
          message: expect.stringContaining("Client not initialized"),
        }),
      });
    });
  });
});
