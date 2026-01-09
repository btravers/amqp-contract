import { NonRetryableError, RetryableError } from "../errors.js";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { it } from "./fixture.js";
import { z } from "zod";

describe("Worker Retry Mechanism", () => {
  describe("Legacy Behavior (No Retry Config)", () => {
    it("should immediately requeue failed messages when retry is not configured", async ({
      workerFactory,
      publishMessage,
    }) => {
      // GIVEN a worker without retry configuration
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("legacy-exchange", "topic", { durable: false });
      const dlx = defineExchange("legacy-dlx", "topic", { durable: false });
      const queue = defineQueue("legacy-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "legacy-queue.dlq",
        },
      });
      const dlq = defineQueue("legacy-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "legacy-queue.dlq",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            attemptCount++;
            if (attemptCount < 2) {
              throw new Error("Simulated failure");
            }
          },
        },
        undefined, // No retry config - legacy mode
      );

      // WHEN publishing a message that fails on first attempt
      publishMessage(exchange.name, "test.message", { id: "legacy-1" });

      // THEN message should be requeued immediately and succeed on second attempt
      await vi.waitFor(
        () => {
          if (attemptCount < 2) {
            throw new Error("Message not yet processed twice");
          }
        },
        { timeout: 5000 },
      );

      expect(attemptCount).toBe(2);
    });
  });

  describe("Retry with Exponential Backoff", () => {
    it("should route retried message through wait queue with TTL", async ({
      workerFactory,
      publishMessage,
      amqpChannel,
    }) => {
      // GIVEN a worker with retry configuration
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("retry-flow-exchange", "topic", { durable: false });
      const dlx = defineExchange("retry-flow-dlx", "topic", { durable: false });
      const queue = defineQueue("retry-flow-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "retry-flow-queue.dlq",
        },
      });
      const dlq = defineQueue("retry-flow-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "retry-flow-queue.dlq",
          }),
          // Bind wait queue to DLX (will be created by worker)
          waitBinding: defineQueueBinding(queue, dlx, {
            routingKey: "retry-flow-queue",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            attemptCount++;
            if (attemptCount === 1) {
              throw new RetryableError("First attempt failed");
            }
          },
        },
        {
          maxRetries: 3,
          initialDelayMs: 500,
          maxDelayMs: 5000,
          backoffMultiplier: 2,
          jitter: false, // Disable jitter for predictable testing
        },
      );

      // Verify wait queue was created
      const waitQueue = await amqpChannel.checkQueue("retry-flow-queue-wait");
      expect(waitQueue.queue).toBe("retry-flow-queue-wait");

      // WHEN publishing a message that fails on first attempt
      publishMessage(exchange.name, "test.message", { id: "retry-1" });

      // THEN wait for first processing attempt
      await vi.waitFor(
        () => {
          if (attemptCount < 1) {
            throw new Error("Message not yet processed");
          }
        },
        { timeout: 2000 },
      );

      expect(attemptCount).toBe(1);

      // AND message should appear in wait queue with correct headers and TTL
      await vi.waitFor(
        async () => {
          const waitMsg = await amqpChannel.get("retry-flow-queue-wait", { noAck: false });
          if (!waitMsg) {
            throw new Error("Message not in wait queue");
          }

          expect(waitMsg.properties).toMatchObject({
            expiration: "500",
            headers: expect.objectContaining({
              "x-retry-count": 1,
              "x-last-error": "First attempt failed",
            }),
          });
          expect(waitMsg.properties.headers?.["x-first-failure-timestamp"]).toBeDefined();

          // Nack to return message for retry
          amqpChannel.nack(waitMsg, false, true);
        },
        { timeout: 2000 },
      );

      // AND after TTL expires, message should be retried successfully
      await vi.waitFor(
        () => {
          if (attemptCount < 2) {
            throw new Error("Message not yet retried");
          }
        },
        { timeout: 3000 },
      );

      expect(attemptCount).toBe(2);
    });

    it("should apply exponential backoff with configurable parameters", async ({
      workerFactory,
      publishMessage,
      amqpChannel,
    }) => {
      // GIVEN a worker with custom backoff configuration
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("backoff-exchange", "topic", { durable: false });
      const dlx = defineExchange("backoff-dlx", "topic", { durable: false });
      const queue = defineQueue("backoff-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "backoff-queue.dlq",
        },
      });
      const dlq = defineQueue("backoff-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "backoff-queue.dlq",
          }),
          waitBinding: defineQueueBinding(queue, dlx, {
            routingKey: "backoff-queue",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            throw new RetryableError("Always fails");
          },
        },
        {
          maxRetries: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 3,
          jitter: false,
        },
      );

      // WHEN publishing a message that always fails
      publishMessage(exchange.name, "test.message", { id: "backoff-1" });

      // THEN each retry should have exponentially increasing TTL: 100, 300, 900
      const expectedDelays = [100, 300, 900]; // 100 * 3^0, 100 * 3^1, 100 * 3^2

      for (let i = 0; i < expectedDelays.length; i++) {
        await vi.waitFor(
          async () => {
            const waitMsg = await amqpChannel.get("backoff-queue-wait", { noAck: false });
            if (!waitMsg) {
              throw new Error(`Retry ${i + 1} not in wait queue`);
            }

            const expectedDelay = expectedDelays[i]!; // Safe: i is within array bounds
            const expiration = Number.parseInt(waitMsg.properties.expiration ?? "0", 10);
            expect(waitMsg.properties).toMatchObject({
              expiration: expectedDelay.toString(),
              headers: expect.objectContaining({
                "x-retry-count": i + 1,
              }),
            });
            expect(expiration).toBe(expectedDelay);

            // Nack to trigger next retry
            amqpChannel.nack(waitMsg, false, false);
          },
          { timeout: 2000 },
        );
      }

      // AND after max retries, message should go to DLQ
      await vi.waitFor(
        async () => {
          const dlqMsg = await amqpChannel.get("backoff-dlq", { noAck: false });
          if (!dlqMsg) {
            throw new Error("Message not in DLQ");
          }
          amqpChannel.ack(dlqMsg);
        },
        { timeout: 2000 },
      );
    });
  });

  describe("NonRetryableError Handling", () => {
    it("should send NonRetryableError directly to DLQ without retries", async ({
      workerFactory,
      publishMessage,
      amqpChannel,
    }) => {
      // GIVEN a worker that throws NonRetryableError
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("nonretry-exchange", "topic", { durable: false });
      const dlx = defineExchange("nonretry-dlx", "topic", { durable: false });
      const queue = defineQueue("nonretry-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "nonretry-queue.dlq",
        },
      });
      const dlq = defineQueue("nonretry-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "nonretry-queue.dlq",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            attemptCount++;
            throw new NonRetryableError("Validation failed - cannot retry");
          },
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
        },
      );

      // WHEN publishing a message that throws NonRetryableError
      publishMessage(exchange.name, "test.message", { id: "nonretry-1" });

      // THEN message should go directly to DLQ without retries
      await vi.waitFor(
        async () => {
          const dlqMsg = await amqpChannel.get("nonretry-dlq", { noAck: false });
          if (!dlqMsg) {
            throw new Error("Message not in DLQ");
          }
          const content = JSON.parse(dlqMsg.content.toString());
          expect(content).toEqual({ id: "nonretry-1" });
          amqpChannel.ack(dlqMsg);
        },
        { timeout: 2000 },
      );

      // AND it should only be attempted once
      expect(attemptCount).toBe(1);

      // AND wait queue should be empty
      const waitMsg = await amqpChannel.get("nonretry-queue-wait", { noAck: false });
      expect(waitMsg).toBe(false);
    });
  });

  describe("Max Retries", () => {
    it("should send to DLQ after max retries exceeded", async ({
      workerFactory,
      publishMessage,
      amqpChannel,
    }) => {
      // GIVEN a worker with maxRetries set to 2
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("maxretry-exchange", "topic", { durable: false });
      const dlx = defineExchange("maxretry-dlx", "topic", { durable: false });
      const queue = defineQueue("maxretry-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "maxretry-queue.dlq",
        },
      });
      const dlq = defineQueue("maxretry-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "maxretry-queue.dlq",
          }),
          waitBinding: defineQueueBinding(queue, dlx, {
            routingKey: "maxretry-queue",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            attemptCount++;
            throw new RetryableError("Always fails");
          },
        },
        {
          maxRetries: 2,
          initialDelayMs: 100,
          maxDelayMs: 500,
          backoffMultiplier: 2,
          jitter: false,
        },
      );

      // WHEN publishing a message that always fails
      publishMessage(exchange.name, "test.message", { id: "maxretry-1" });

      // THEN should retry exactly maxRetries times (initial attempt + 2 retries = 3 total)
      await vi.waitFor(
        () => {
          if (attemptCount < 3) {
            throw new Error("Not all retry attempts completed");
          }
        },
        { timeout: 5000 },
      );

      expect(attemptCount).toBe(3);

      // AND message should end up in DLQ
      await vi.waitFor(
        async () => {
          const dlqMsg = await amqpChannel.get("maxretry-dlq", { noAck: false });
          if (!dlqMsg) {
            throw new Error("Message not in DLQ");
          }
          const content = JSON.parse(dlqMsg.content.toString());
          expect(content).toEqual({ id: "maxretry-1" });
          amqpChannel.ack(dlqMsg);
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Retry Headers Tracking", () => {
    it("should track retry count, last error, and first failure timestamp", async ({
      workerFactory,
      publishMessage,
      amqpChannel,
    }) => {
      // GIVEN a worker that always fails
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("headers-exchange", "topic", { durable: false });
      const dlx = defineExchange("headers-dlx", "topic", { durable: false });
      const queue = defineQueue("headers-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "headers-queue.dlq",
        },
      });
      const dlq = defineQueue("headers-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "headers-queue.dlq",
          }),
          waitBinding: defineQueueBinding(queue, dlx, {
            routingKey: "headers-queue",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            throw new RetryableError("Test error message");
          },
        },
        {
          maxRetries: 1,
          initialDelayMs: 100,
          jitter: false,
        },
      );

      // WHEN publishing a message that fails
      const startTime = Date.now();
      publishMessage(exchange.name, "test.message", { id: "headers-1" });

      // THEN message in wait queue should have retry tracking headers
      await vi.waitFor(
        async () => {
          const waitMsg = await amqpChannel.get("headers-queue-wait", { noAck: false });
          if (!waitMsg) {
            throw new Error("Message not in wait queue");
          }

          const firstFailureTimestamp = waitMsg.properties.headers?.["x-first-failure-timestamp"];
          expect(waitMsg.properties.headers).toMatchObject({
            "x-retry-count": 1,
            "x-last-error": "Test error message",
          });
          expect(firstFailureTimestamp).toBeGreaterThanOrEqual(startTime);
          expect(firstFailureTimestamp).toBeLessThanOrEqual(Date.now());

          // Nack to let it go to DLQ
          amqpChannel.nack(waitMsg, false, false);
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Batch Processing with Retry", () => {
    it("should retry all messages in a failed batch", async ({ workerFactory, publishMessage }) => {
      // GIVEN a batch consumer that fails on first attempt
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("batch-retry-exchange", "topic", { durable: false });
      const dlx = defineExchange("batch-retry-dlx", "topic", { durable: false });
      const queue = defineQueue("batch-retry-queue", {
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "batch-retry-queue.dlq",
        },
      });
      const dlq = defineQueue("batch-retry-dlq", { durable: false });

      const contract = defineContract({
        exchanges: {
          main: exchange,
          dlx,
        },
        queues: {
          main: queue,
          dlq,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
          dlqBinding: defineQueueBinding(dlq, dlx, {
            routingKey: "batch-retry-queue.dlq",
          }),
          waitBinding: defineQueueBinding(queue, dlx, {
            routingKey: "batch-retry-queue",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let batchAttemptCount = 0;
      await workerFactory(
        contract,
        {
          testConsumer: [
            async (_messages: Array<{ id: string }>) => {
              batchAttemptCount++;
              if (batchAttemptCount === 1) {
                throw new RetryableError("Batch failed");
              }
              // Second attempt succeeds
            },
            { batchSize: 3, batchTimeout: 500 },
          ],
        },
        {
          maxRetries: 3,
          initialDelayMs: 200,
          jitter: false,
        },
      );

      // WHEN publishing 3 messages to form a batch
      publishMessage(exchange.name, "test.message", { id: "batch-1" });
      publishMessage(exchange.name, "test.message", { id: "batch-2" });
      publishMessage(exchange.name, "test.message", { id: "batch-3" });

      // THEN batch should be retried and succeed on second attempt
      await vi.waitFor(
        () => {
          if (batchAttemptCount < 2) {
            throw new Error("Batch not yet retried");
          }
        },
        { timeout: 3000 },
      );

      expect(batchAttemptCount).toBe(2);
    });
  });

  describe("Queue Without DLX", () => {
    it("should fallback to requeue when retry is enabled but queue has no DLX", async ({
      workerFactory,
      publishMessage,
    }) => {
      // GIVEN a queue without dead letter exchange configuration
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("nodlx-exchange", "topic", { durable: false });
      const queue = defineQueue("nodlx-queue", {
        durable: false,
        // No deadLetter configuration
      });

      const contract = defineContract({
        exchanges: {
          main: exchange,
        },
        queues: {
          main: queue,
        },
        bindings: {
          mainBinding: defineQueueBinding(queue, exchange, {
            routingKey: "test.#",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(
        contract,
        {
          testConsumer: async () => {
            attemptCount++;
            if (attemptCount < 2) {
              throw new RetryableError("Will fallback to requeue");
            }
          },
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
        },
      );

      // WHEN publishing a message that fails on first attempt
      publishMessage(exchange.name, "test.message", { id: "nodlx-1" });

      // THEN should fallback to legacy requeue behavior and eventually succeed
      await vi.waitFor(
        () => {
          if (attemptCount < 2) {
            throw new Error("Message not yet retried via requeue");
          }
        },
        { timeout: 2000 },
      );

      expect(attemptCount).toBe(2);
    });
  });
});
