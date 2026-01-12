import { beforeEach, describe, expect } from "vitest";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { AmqpClient } from "../amqp-client.js";
import type { ConsumeMessage } from "amqplib";
import { it } from "@amqp-contract/testing/extension";
import { z } from "zod";

describe("Priority Queue", () => {
  beforeEach(async () => {
    // Reset connection cache between tests
    await AmqpClient._resetConnectionCacheForTesting();
  });

  it("should create a queue with x-max-priority argument", async ({
    amqpConnectionUrl,
    amqpChannel,
  }) => {
    // GIVEN
    // Priority queues require classic queue type
    const priorityQueue = defineQueue("test-priority-queue", {
      type: "classic",
      durable: false,
      maxPriority: 10,
    });

    const contract = defineContract({
      queues: {
        priority: priorityQueue,
      },
    });

    // WHEN
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // THEN - Verify queue was created with x-max-priority
    const queueInfo = await amqpChannel.checkQueue("test-priority-queue");
    expect(queueInfo.queue).toBe("test-priority-queue");

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue("test-priority-queue");
  });

  it("should consume messages in priority order", async ({ amqpConnectionUrl, amqpChannel }) => {
    // GIVEN
    const exchange = defineExchange("test-priority-exchange", "direct", { durable: false });
    // Priority queues require classic queue type
    const priorityQueue = defineQueue("test-priority-queue-ordering", {
      type: "classic",
      durable: false,
      maxPriority: 10,
    });

    const messageSchema = z.object({
      id: z.string(),
      priority: z.number(),
    });

    const message = defineMessage(messageSchema);

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        priority: priorityQueue,
      },
      bindings: {
        testBinding: defineQueueBinding(priorityQueue, exchange, {
          routingKey: "test",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, message, {
          routingKey: "test",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(priorityQueue, message),
      },
    });

    // WHEN - Setup client and publish messages in reverse priority order
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // Publish messages with different priorities
    // Publishing in this order: low (1), medium (5), high (10)
    await client.channel.publish(
      exchange.name,
      "test",
      { id: "msg-low", priority: 1 },
      { priority: 1 },
    );

    await client.channel.publish(
      exchange.name,
      "test",
      { id: "msg-medium", priority: 5 },
      { priority: 5 },
    );

    await client.channel.publish(
      exchange.name,
      "test",
      { id: "msg-high", priority: 10 },
      { priority: 10 },
    );

    // Give RabbitMQ time to order the messages
    await new Promise((resolve) => setTimeout(resolve, 100));

    // THEN - Consume messages and verify they arrive in priority order
    const consumedMessages: Array<{ id: string; priority: number }> = [];

    const consumePromise = new Promise<void>((resolve) => {
      let consumedCount = 0;

      amqpChannel.consume(
        priorityQueue.name,
        (msg: ConsumeMessage | null) => {
          if (msg) {
            const content = JSON.parse(msg.content.toString());
            consumedMessages.push(content);
            amqpChannel.ack(msg);

            consumedCount++;
            if (consumedCount === 3) {
              resolve();
            }
          }
        },
        { noAck: false },
      );
    });

    await consumePromise;

    // Verify messages were consumed in priority order (high to low)
    expect(consumedMessages).toEqual([
      { id: "msg-high", priority: 10 },
      { id: "msg-medium", priority: 5 },
      { id: "msg-low", priority: 1 },
    ]);

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue(priorityQueue.name);
    await amqpChannel.deleteExchange(exchange.name);
  });

  it("should handle messages without priority (default to 0)", async ({
    amqpConnectionUrl,
    amqpChannel,
  }) => {
    // GIVEN
    const exchange = defineExchange("test-priority-default-exchange", "direct", {
      durable: false,
    });
    // Priority queues require classic queue type
    const priorityQueue = defineQueue("test-priority-default-queue", {
      type: "classic",
      durable: false,
      maxPriority: 10,
    });

    const messageSchema = z.object({
      id: z.string(),
    });

    const message = defineMessage(messageSchema);

    const contract = defineContract({
      exchanges: {
        test: exchange,
      },
      queues: {
        priority: priorityQueue,
      },
      bindings: {
        testBinding: defineQueueBinding(priorityQueue, exchange, {
          routingKey: "test",
        }),
      },
      publishers: {
        testPublisher: definePublisher(exchange, message, {
          routingKey: "test",
        }),
      },
      consumers: {
        testConsumer: defineConsumer(priorityQueue, message),
      },
    });

    // WHEN - Setup client and publish messages with and without priority
    const client = new AmqpClient(contract, {
      urls: [amqpConnectionUrl],
    });

    await client.channel.waitForConnect();

    // Publish message without priority (defaults to 0)
    await client.channel.publish(exchange.name, "test", { id: "msg-default" });

    // Publish message with priority 5
    await client.channel.publish(exchange.name, "test", { id: "msg-priority" }, { priority: 5 });

    // Give RabbitMQ time to order the messages
    await new Promise((resolve) => setTimeout(resolve, 100));

    // THEN - Consume messages and verify priority message comes first
    const consumedMessages: Array<{ id: string }> = [];

    const consumePromise = new Promise<void>((resolve) => {
      let consumedCount = 0;

      amqpChannel.consume(
        priorityQueue.name,
        (msg: ConsumeMessage | null) => {
          if (msg) {
            const content = JSON.parse(msg.content.toString());
            consumedMessages.push(content);
            amqpChannel.ack(msg);

            consumedCount++;
            if (consumedCount === 2) {
              resolve();
            }
          }
        },
        { noAck: false },
      );
    });

    await consumePromise;

    // Verify priority message was consumed first
    expect(consumedMessages).toEqual([{ id: "msg-priority" }, { id: "msg-default" }]);

    // CLEANUP
    await client.close();
    await amqpChannel.deleteQueue(priorityQueue.name);
    await amqpChannel.deleteExchange(exchange.name);
  });
});
