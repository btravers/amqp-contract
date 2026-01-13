import { Future, Result } from "@swan-io/boxed";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { RetryableError } from "../errors.js";
import { defineHandler } from "../handlers.js";
import { it } from "./fixture.js";
import { z } from "zod";

describe("Worker Retry Mechanism", () => {
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
        type: "classic",
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "retry-flow-queue.dlq",
        },
      });
      const dlq = defineQueue("retry-flow-dlq", { type: "classic", durable: false });

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
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(contract, {
        testConsumer: [
          () => {
            attemptCount++;
            if (attemptCount === 1) {
              return Future.value(Result.Error(new RetryableError("First attempt failed")));
            }
            return Future.value(Result.Ok(undefined));
          },
          {
            retry: {
              maxRetries: 3,
              initialDelayMs: 500,
              maxDelayMs: 5000,
              backoffMultiplier: 2,
              jitter: false, // Disable jitter for predictable testing
            },
          },
        ],
      });

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
        type: "classic",
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "backoff-queue.dlq",
        },
      });
      const dlq = defineQueue("backoff-dlq", { type: "classic", durable: false });

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
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      await workerFactory(contract, {
        testConsumer: [
          () => Future.value(Result.Error(new RetryableError("Always fails"))),
          {
            retry: {
              maxRetries: 3,
              initialDelayMs: 100,
              maxDelayMs: 1000,
              backoffMultiplier: 3,
              jitter: false,
            },
          },
        ],
      });

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
            expect(waitMsg.properties).toMatchObject({
              expiration: expectedDelay.toString(),
              headers: expect.objectContaining({
                "x-retry-count": i + 1,
              }),
            });

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
        type: "classic",
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "maxretry-queue.dlq",
        },
      });
      const dlq = defineQueue("maxretry-dlq", { type: "classic", durable: false });

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
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(contract, {
        testConsumer: [
          () => {
            attemptCount++;
            return Future.value(Result.Error(new RetryableError("Always fails")));
          },
          {
            retry: {
              maxRetries: 2,
              initialDelayMs: 100,
              maxDelayMs: 500,
              backoffMultiplier: 2,
              jitter: false,
            },
          },
        ],
      });

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
        type: "classic",
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "headers-queue.dlq",
        },
      });
      const dlq = defineQueue("headers-dlq", { type: "classic", durable: false });

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
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      await workerFactory(contract, {
        testConsumer: [
          () => Future.value(Result.Error(new RetryableError("Test error message"))),
          {
            retry: {
              maxRetries: 1,
              initialDelayMs: 100,
              jitter: false,
            },
          },
        ],
      });

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
        type: "classic",
        durable: false,
        deadLetter: {
          exchange: dlx,
          routingKey: "batch-retry-queue.dlq",
        },
      });
      const dlq = defineQueue("batch-retry-dlq", { type: "classic", durable: false });

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
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let batchAttemptCount = 0;
      await workerFactory(contract, {
        testConsumer: defineHandler(
          contract,
          "testConsumer",
          () => {
            batchAttemptCount++;
            if (batchAttemptCount === 1) {
              return Future.value(Result.Error(new RetryableError("Batch failed")));
            }
            // Second attempt succeeds
            return Future.value(Result.Ok(undefined));
          },
          {
            batchSize: 3,
            batchTimeout: 500,
            retry: {
              maxRetries: 3,
              initialDelayMs: 200,
              jitter: false,
            },
          },
        ),
      });

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
    it("should fallback to requeue when queue has no DLX", async ({
      workerFactory,
      publishMessage,
    }) => {
      // GIVEN a queue without dead letter exchange configuration
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("nodlx-exchange", "topic", { durable: false });
      const queue = defineQueue("nodlx-queue", {
        type: "classic",
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
      await workerFactory(contract, {
        // Retry is enabled by default, but queue has no DLX
        testConsumer: () => {
          attemptCount++;
          if (attemptCount < 2) {
            return Future.value(Result.Error(new RetryableError("Will fallback to requeue")));
          }
          return Future.value(Result.Ok(undefined));
        },
      });

      // WHEN publishing a message that fails on first attempt
      publishMessage(exchange.name, "test.message", { id: "nodlx-1" });

      // THEN should fallback to requeue behavior and eventually succeed
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

  describe("Quorum Native Retry Mode", () => {
    it("should use RabbitMQ's native delivery limit for retry handling", async ({
      workerFactory,
      publishMessage,
    }) => {
      // GIVEN a quorum queue with delivery limit configured
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("quorum-native-exchange", "topic", { durable: true });
      const dlx = defineExchange("quorum-native-dlx", "topic", { durable: true });

      // Quorum queue with deliveryLimit - RabbitMQ tracks x-delivery-count automatically
      const queue = defineQueue("quorum-native-queue", {
        type: "quorum",
        deliveryLimit: 3, // Allow up to 3 delivery attempts before dead-lettering
        deadLetter: {
          exchange: dlx,
          routingKey: "quorum-native-queue.dlq",
        },
      });
      const dlq = defineQueue("quorum-native-dlq", { type: "quorum" });

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
            routingKey: "quorum-native-queue.dlq",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(contract, {
        testConsumer: [
          () => {
            attemptCount++;
            if (attemptCount < 2) {
              // This triggers a nack with requeue=true in quorum-native mode
              return Future.value(Result.Error(new RetryableError("Simulated failure")));
            }
            return Future.value(Result.Ok(undefined));
          },
          {
            retry: {
              mode: "quorum-native", // Use quorum queue's native delivery limit
            },
          },
        ],
      });

      // WHEN publishing a message that fails on first attempt
      publishMessage(exchange.name, "test.message", { id: "quorum-native-1" });

      // THEN message should be requeued immediately (via nack) and succeed on second attempt
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

    it("should send message to DLQ after exceeding deliveryLimit", async ({
      workerFactory,
      publishMessage,
      amqpChannel,
    }) => {
      // GIVEN a quorum queue with delivery limit of 2
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("quorum-dlq-exchange", "topic", { durable: true });
      const dlx = defineExchange("quorum-dlq-dlx", "topic", { durable: true });

      const queue = defineQueue("quorum-dlq-queue", {
        type: "quorum",
        deliveryLimit: 2, // Message dead-lettered after 2 delivery attempts
        deadLetter: {
          exchange: dlx,
          routingKey: "quorum-dlq-queue.dlq",
        },
      });
      const dlq = defineQueue("quorum-dlq-dlq", { type: "quorum" });

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
            routingKey: "quorum-dlq-queue.dlq",
          }),
        },
        consumers: {
          testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
        },
      });

      let attemptCount = 0;
      await workerFactory(contract, {
        testConsumer: [
          () => {
            attemptCount++;
            // Always fail - message should be dead-lettered after deliveryLimit
            return Future.value(Result.Error(new RetryableError("Always fails")));
          },
          {
            retry: {
              mode: "quorum-native",
            },
          },
        ],
      });

      // WHEN publishing a message that always fails
      publishMessage(exchange.name, "test.message", { id: "quorum-dlq-1" });

      // THEN message should be dead-lettered after exceeding delivery limit
      // Wait for the message to appear in DLQ
      await vi.waitFor(
        async () => {
          const dlqMsg = await amqpChannel.get("quorum-dlq-dlq", { noAck: false });
          if (!dlqMsg) {
            throw new Error("Message not in DLQ yet");
          }
          const content = JSON.parse(dlqMsg.content.toString());
          expect(content).toEqual({ id: "quorum-dlq-1" });
          amqpChannel.ack(dlqMsg);
        },
        { timeout: 10000 },
      );

      // Message should have been processed deliveryLimit times
      expect(attemptCount).toBeGreaterThanOrEqual(2);
    });
  });
});
