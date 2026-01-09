import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, vi } from "vitest";
import { RetryableError } from "../errors.js";
import { it } from "./fixtures.js";
import { z } from "zod";

describe("Worker Retry Mechanism", () => {
  it("should retry on RetryableError with exponential backoff", async ({
    workerFactory,
    publishMessage,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    // Create DLX (Dead Letter Exchange) - can be any standard type
    const dlx = defineExchange("retry-test-dlx", "direct", {
      durable: false,
    });

    // Main exchange can be any type (topic in this case)
    const exchange = defineExchange("retry-test-exchange", "topic", {
      durable: false,
    });

    // Main queue configured with DLX
    const queue = defineQueue("retry-test-queue", {
      durable: false,
      deadLetter: {
        exchange: dlx,
        routingKey: "retry-test-queue", // Route back to same queue name
      },
    });

    // DLQ (Dead Letter Queue) for messages that exceed max retries
    const dlq = defineQueue("retry-test-dlq", { durable: false });

    const contract = defineContract({
      exchanges: {
        main: exchange,
        dlx: dlx,
      },
      queues: {
        mainQueue: queue,
        dlq: dlq,
      },
      bindings: {
        // Normal binding for incoming messages
        mainBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
        // DLX routes back to main queue for retries
        retryBinding: defineQueueBinding(queue, dlx, {
          routingKey: "retry-test-queue",
        }),
        // DLX routes to DLQ for failed messages (optional - if DLQ binding not present, messages are dropped)
        dlqBinding: defineQueueBinding(dlq, dlx, {
          routingKey: "retry-test-dlq",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    let attempts = 0;
    const successAfterAttempts = 2;
    const attemptTimestamps: number[] = [];

    await workerFactory(
      contract,
      {
        testConsumer: async (_msg) => {
          attempts++;
          attemptTimestamps.push(Date.now());
          if (attempts < successAfterAttempts) {
            throw new RetryableError("Simulated transient failure");
          }
        },
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        jitter: false, // Disable jitter for predictable testing
      },
    );

    // WHEN
    publishMessage(exchange.name, "test.message", {
      id: "retry-test-1",
      value: 42,
    });

    // THEN - Wait for retry and eventual success
    await vi.waitFor(
      () => {
        if (attempts < successAfterAttempts) {
          throw new Error("Not yet successful");
        }
      },
      { timeout: 5000 },
    );

    expect(attempts).toBe(successAfterAttempts);

    // Verify that there was an actual delay between attempts
    // With initialDelayMs=100 and no jitter, first retry should be ~100ms after initial attempt
    if (attemptTimestamps.length >= 2) {
      const delayBetweenAttempts = attemptTimestamps[1]! - attemptTimestamps[0]!;
      // Allow some tolerance (50ms to 300ms) for processing overhead
      expect(delayBetweenAttempts).toBeGreaterThanOrEqual(50);
      expect(delayBetweenAttempts).toBeLessThan(300);
    }
  });

  it("should send to DLQ after max retries on RetryableError", async ({
    workerFactory,
    publishMessage,
    amqpChannel,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    // DLX (Dead Letter Exchange) - uses standard exchange for DLX
    const dlx = defineExchange("retry-dlq-dlx", "direct", {
      durable: false,
    });

    // Main exchange
    const exchange = defineExchange("retry-dlq-exchange", "topic", {
      durable: false,
    });

    // Main queue with DLX configuration
    const queue = defineQueue("retry-dlq-queue", {
      durable: false,
      deadLetter: {
        exchange: dlx,
        routingKey: "retry-dlq-queue",
      },
    });

    // DLQ for messages that exceed max retries
    const dlqQueue = defineQueue("retry-dlq-dead-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        main: exchange,
        dlx: dlx,
      },
      queues: {
        mainQueue: queue,
        dlqQueue: dlqQueue,
      },
      bindings: {
        // Normal binding for incoming messages
        mainBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
        // DLX routes back to main queue for retries
        retryBinding: defineQueueBinding(queue, dlx, {
          routingKey: "retry-dlq-queue",
        }),
        // DLX routes to DLQ for failed messages
        dlqBinding: defineQueueBinding(dlqQueue, dlx, {
          routingKey: "retry-dlq-dead-queue",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    let attempts = 0;
    const maxRetries = 2;

    await workerFactory(
      contract,
      {
        testConsumer: async () => {
          attempts++;
          // Always fail
          throw new RetryableError("Persistent failure");
        },
      },
      {
        maxRetries,
        initialDelayMs: 100,
        jitter: false,
      },
    );

    // WHEN
    publishMessage(exchange.name, "test.message", {
      id: "dlq-test-1",
      value: 42,
    });

    // THEN - Wait for all retry attempts (original + maxRetries attempts)
    await vi.waitFor(
      () => {
        if (attempts <= maxRetries) {
          throw new Error("Not yet exceeded retries");
        }
      },
      { timeout: 5000 },
    );

    expect(attempts).toBe(maxRetries + 1); // Original attempt + 2 retries

    // Verify message is in DLQ
    const dlqMessage = await amqpChannel.get(dlqQueue.name);
    if (!dlqMessage) {
      throw new Error("Expected message in DLQ queue, but none was found");
    }

    amqpChannel.ack(dlqMessage);

    const content = JSON.parse(dlqMessage.content.toString());
    expect(content).toMatchObject({
      id: "dlq-test-1",
      value: 42,
    });
  });

  it("should not retry regular errors (only RetryableError is retried)", async ({
    workerFactory,
    publishMessage,
    amqpChannel,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    // DLX
    const dlx = defineExchange("non-retry-dlx", "direct", {
      durable: false,
    });

    // Main exchange
    const exchange = defineExchange("non-retry-exchange", "topic", {
      durable: false,
    });

    // Main queue with DLX configuration
    const queue = defineQueue("non-retry-queue", {
      durable: false,
      deadLetter: {
        exchange: dlx,
        routingKey: "non-retry-queue",
      },
    });

    // DLQ
    const dlqQueue = defineQueue("non-retry-dead-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        main: exchange,
        dlx: dlx,
      },
      queues: {
        mainQueue: queue,
        dlqQueue: dlqQueue,
      },
      bindings: {
        // Normal binding for incoming messages
        mainBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
        // DLX routes back to main queue for retries (not used in this test)
        retryBinding: defineQueueBinding(queue, dlx, {
          routingKey: "non-retry-queue",
        }),
        // DLX routes to DLQ for failed messages
        dlqBinding: defineQueueBinding(dlqQueue, dlx, {
          routingKey: "non-retry-dead-queue",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    let attempts = 0;

    await workerFactory(
      contract,
      {
        testConsumer: async () => {
          attempts++;
          throw new Error("Validation failed - not retryable");
        },
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
      },
    );

    // WHEN
    publishMessage(exchange.name, "test.message", {
      id: "non-retry-test-1",
      value: 42,
    });

    // THEN - Should only attempt once
    await vi.waitFor(
      () => {
        if (attempts < 1) {
          throw new Error("Not yet processed");
        }
      },
      { timeout: 5000 },
    );

    expect(attempts).toBe(1); // Only one attempt, no retries

    // Verify message is in DLQ
    const dlqMessage = await amqpChannel.get(dlqQueue.name);
    if (!dlqMessage) {
      throw new Error("Expected message to be present in DLQ queue");
    }

    amqpChannel.ack(dlqMessage);

    const content = JSON.parse(dlqMessage.content.toString());
    expect(content).toMatchObject({
      id: "non-retry-test-1",
      value: 42,
    });
  });

  it("should track retry count in message headers", async ({
    workerFactory,
    publishMessage,
    amqpChannel,
  }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    const exchange = defineExchange("retry-headers-exchange", "topic", {
      durable: false,
    });
    const dlqExchange = defineExchange("retry-headers-dlq", "topic", { durable: false });
    const queue = defineQueue("retry-headers-queue", {
      durable: false,
      deadLetter: {
        exchange: dlqExchange,
      },
    });
    const dlqQueue = defineQueue("retry-headers-dead-queue", { durable: false });

    const contract = defineContract({
      exchanges: {
        test: exchange,
        dlq: dlqExchange,
      },
      queues: {
        testQueue: queue,
        dlqQueue: dlqQueue,
      },
      bindings: {
        testBinding: defineQueueBinding(queue, exchange, {
          routingKey: "test.#",
        }),
        // Retry binding: queue-specific routing key for retries
        retryBinding: defineQueueBinding(queue, exchange, {
          routingKey: "retry-headers-queue.retry",
        }),
        dlqBinding: defineQueueBinding(dlqQueue, dlqExchange, {
          routingKey: "#",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    let attempts = 0;

    await workerFactory(
      contract,
      {
        testConsumer: async () => {
          attempts++;
          throw new RetryableError("Always fail");
        },
      },
      {
        maxRetries: 2,
        initialDelayMs: 100,
        jitter: false,
      },
    );

    // WHEN
    publishMessage(exchange.name, "test.message", {
      id: "retry-headers-test",
      value: 42,
    });

    // THEN - Wait for all retries
    await vi.waitFor(
      () => {
        if (attempts <= 2) {
          throw new Error("Not yet exceeded retries");
        }
      },
      { timeout: 5000 },
    );

    // Check DLQ message has retry headers
    const dlqMessage = await amqpChannel.get(dlqQueue.name);
    if (!dlqMessage) {
      throw new Error("Expected a message in the DLQ but none was found");
    }

    amqpChannel.ack(dlqMessage);

    expect(dlqMessage.properties.headers).toHaveProperty("x-death");
  });

  it("should handle batch processing with retries", async ({ workerFactory, publishMessage }) => {
    // GIVEN
    const TestMessage = z.object({
      id: z.string(),
      value: z.number(),
    });

    const exchange = defineExchange("batch-retry-exchange", "topic", {
      durable: false,
    });
    const queue = defineQueue("batch-retry-queue", { durable: false });

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
        // Retry binding: queue-specific routing key for retries
        retryBinding: defineQueueBinding(queue, exchange, {
          routingKey: "batch-retry-queue.retry",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
          routingKey: "test.message",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(queue, defineMessage(TestMessage)),
      },
    });

    let batchAttempts = 0;
    const successAfterAttempts = 2;

    await workerFactory(
      contract,
      {
        testConsumer: [
          async (_messages: Array<{ id: string; value: number }>) => {
            batchAttempts++;
            if (batchAttempts < successAfterAttempts) {
              throw new RetryableError("Batch processing failed");
            }
            // Success on 2nd attempt
          },
          { batchSize: 2, batchTimeout: 500 },
        ],
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        jitter: false,
      },
    );

    // WHEN - Send batch of messages
    publishMessage(exchange.name, "test.message", { id: "batch-1", value: 1 });
    publishMessage(exchange.name, "test.message", { id: "batch-2", value: 2 });

    // THEN
    await vi.waitFor(
      () => {
        if (batchAttempts < successAfterAttempts) {
          throw new Error("Batch not yet successful");
        }
      },
      { timeout: 5000 },
    );

    expect(batchAttempts).toBe(successAfterAttempts);
  });
});
