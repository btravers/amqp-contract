import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

describe("TypedAmqpWorker", () => {
  describe("null message handling", () => {
    it("should handle null messages gracefully when consumer is cancelled", async () => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });
      const exchange = defineExchange("test-exchange", "topic", { durable: false });
      const queue = defineQueue("test-queue", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        queues: {
          testQueue: queue,
        },
        bindings: {
          testBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const handler = vi.fn().mockResolvedValue(undefined);

      let consumeCallback: ((msg: unknown) => Promise<void>) | null = null;

      // Mock the AmqpClient to capture the consume callback
      const mockChannel = {
        waitForConnect: vi.fn().mockResolvedValue(undefined),
        consume: vi.fn().mockImplementation(async (_queueName, callback: (msg: unknown) => Promise<void>) => {
          consumeCallback = callback;
        }),
        ack: vi.fn(),
        nack: vi.fn(),
      };

      const mockAmqpClient = {
        channel: mockChannel,
        close: vi.fn().mockResolvedValue(undefined),
      };

      // Dynamically import and create worker
      const { TypedAmqpWorker } = await import("./worker.js");
      
      // Create worker using reflection to bypass private constructor
      const WorkerClass = TypedAmqpWorker as unknown as {
        new (
          contract: typeof contract,
          amqpClient: typeof mockAmqpClient,
          handlers: { testConsumer: typeof handler },
          logger: typeof mockLogger,
        ): {
          consumeAll(): { resultToPromise(): Promise<void> };
        };
      };

      const worker = new WorkerClass(contract, mockAmqpClient, {
        testConsumer: handler,
      }, mockLogger);

      // WHEN - Start consuming
      await worker.consumeAll().resultToPromise();

      // Simulate RabbitMQ sending null when consumer is cancelled
      if (consumeCallback) {
        await consumeCallback(null);
      }

      // THEN - Should log warning about consumer cancellation
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Consumer cancelled by server",
        expect.objectContaining({
          consumerName: "testConsumer",
          queueName: "test-queue",
        }),
      );

      // Handler should not be called for null message
      expect(handler).not.toHaveBeenCalled();

      // Should not attempt to ack/nack null message
      expect(mockChannel.ack).not.toHaveBeenCalled();
      expect(mockChannel.nack).not.toHaveBeenCalled();
    });
  });
});
