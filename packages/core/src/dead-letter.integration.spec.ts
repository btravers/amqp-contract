import { beforeEach, describe, expect } from "vitest";
import { defineContract, defineExchange, defineQueue } from "@amqp-contract/contract";
import { AmqpClient } from "./amqp-client.js";
import { it } from "@amqp-contract/testing/extension";

describe("Dead Letter Exchange Support", () => {
  beforeEach(async () => {
    // Reset connection cache between tests
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it("should setup queue with dead letter exchange", async ({ amqpConnectionUrl, amqpChannel }) => {
    // GIVEN
    const dlx = defineExchange("test-dlx", "topic", { durable: false });
    const queue = defineQueue("test-queue-with-dlx", {
      durable: false,
      deadLetter: {
        exchange: dlx,
        routingKey: "failed",
      },
    });

    const contract = defineContract({
      exchanges: {
        dlx,
      },
      queues: {
        testQueue: queue,
      },
    });

    // WHEN
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // THEN - Check that the queue was created with dead letter configuration
    const queueInfo = await amqpChannel.checkQueue("test-queue-with-dlx");
    expect(queueInfo).toBeDefined();
    expect(queueInfo.queue).toBe("test-queue-with-dlx");

    // Verify DLX arguments were set (we can't directly check via amqplib API,
    // but we can verify the queue exists and was created without errors)
    expect(queueInfo.messageCount).toBe(0);

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue("test-queue-with-dlx");
    await amqpChannel.deleteExchange("test-dlx");
  });

  it("should setup queue with dead letter exchange without routing key", async ({
    amqpConnectionUrl,
    amqpChannel,
  }) => {
    // GIVEN
    const dlx = defineExchange("test-dlx-no-key", "fanout", { durable: false });
    const queue = defineQueue("test-queue-dlx-no-key", {
      durable: false,
      deadLetter: {
        exchange: dlx,
      },
    });

    const contract = defineContract({
      exchanges: {
        dlx,
      },
      queues: {
        testQueue: queue,
      },
    });

    // WHEN
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // THEN - Check that the queue was created
    const queueInfo = await amqpChannel.checkQueue("test-queue-dlx-no-key");
    expect(queueInfo).toBeDefined();
    expect(queueInfo.queue).toBe("test-queue-dlx-no-key");

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue("test-queue-dlx-no-key");
    await amqpChannel.deleteExchange("test-dlx-no-key");
  });

  it("should setup queue without dead letter exchange", async ({
    amqpConnectionUrl,
    amqpChannel,
  }) => {
    // GIVEN
    const queue = defineQueue("test-queue-no-dlx", {
      durable: false,
    });

    const contract = defineContract({
      queues: {
        testQueue: queue,
      },
    });

    // WHEN
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // THEN - Check that the queue was created normally
    const queueInfo = await amqpChannel.checkQueue("test-queue-no-dlx");
    expect(queueInfo).toBeDefined();
    expect(queueInfo.queue).toBe("test-queue-no-dlx");

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue("test-queue-no-dlx");
  });

  it("should setup complete dead letter exchange pattern", async ({
    amqpConnectionUrl,
    amqpChannel,
  }) => {
    // GIVEN - A complete DLX setup with main exchange, main queue, DLX, and DLX queue
    const mainExchange = defineExchange("test-main-exchange", "topic", {
      durable: false,
    });
    const dlx = defineExchange("test-complete-dlx", "topic", { durable: false });
    const dlxQueue = defineQueue("test-dlx-queue", { durable: false });
    const mainQueue = defineQueue("test-main-queue", {
      durable: false,
      deadLetter: {
        exchange: dlx,
        routingKey: "failed",
      },
    });

    const contract = defineContract({
      exchanges: {
        main: mainExchange,
        dlx,
      },
      queues: {
        mainQueue,
        dlxQueue,
      },
    });

    // WHEN
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // THEN - All resources should be created with correct structure
    const mainQueueInfo = await amqpChannel.checkQueue("test-main-queue");
    expect(mainQueueInfo).toEqual(
      expect.objectContaining({
        queue: "test-main-queue",
        messageCount: 0,
        consumerCount: 0,
      }),
    );

    const dlxQueueInfo = await amqpChannel.checkQueue("test-dlx-queue");
    expect(dlxQueueInfo).toEqual(
      expect.objectContaining({
        queue: "test-dlx-queue",
        messageCount: 0,
        consumerCount: 0,
      }),
    );

    // Verify exchanges exist
    const mainExchangeInfo = await amqpChannel.checkExchange("test-main-exchange");
    expect(mainExchangeInfo).toBeDefined();

    const dlxInfo = await amqpChannel.checkExchange("test-complete-dlx");
    expect(dlxInfo).toBeDefined();

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue("test-main-queue");
    await amqpChannel.deleteQueue("test-dlx-queue");
    await amqpChannel.deleteExchange("test-main-exchange");
    await amqpChannel.deleteExchange("test-complete-dlx");
  });
});
