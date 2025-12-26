import {
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect } from "vitest";
import { Result } from "@swan-io/boxed";
import { TypedAmqpClient } from "./client.js";
import { it } from "@amqp-contract/testing/extension";
import { z } from "zod";

describe("AmqpClient Integration", () => {
  describe("end-to-end publishing", () => {
    it("should publish messages to a real RabbitMQ instance", async ({
      amqpConnectionUrl,
      initConsumer,
    }) => {
      // GIVEN
      const exchange = defineExchange("test-exchange", "topic", { durable: false });
      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        publishers: {
          testPublisher: definePublisher(
            exchange,
            defineMessage(
              z.object({
                id: z.string(),
                message: z.string(),
              }),
            ),
            {
              routingKey: "test.key",
            },
          ),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      const pendingMessages = await initConsumer(
        contract.publishers.testPublisher.exchange.name,
        contract.publishers.testPublisher.routingKey,
      );

      // WHEN
      const result = await client.publish("testPublisher", {
        id: "123",
        message: "Hello, RabbitMQ!",
      });

      // THEN
      expect(result).toEqual(Result.Ok(true));

      await expect(pendingMessages()).resolves.toEqual([
        expect.objectContaining({
          content: Buffer.from(JSON.stringify({ id: "123", message: "Hello, RabbitMQ!" })),
        }),
      ]);

      // CLEANUP
      await client.close();
    });

    it("should validate messages before publishing", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({
        id: z.string(),
        count: z.number().positive(),
      });

      const exchange = defineExchange("test-validation-exchange", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        publishers: {
          testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
            routingKey: "validation.test",
          }),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      // WHEN
      const result = await client.publish("testPublisher", {
        id: "123",
        count: -5, // Invalid: count must be positive
      });

      // THEN
      expect(result).toMatchObject({
        tag: "Error",
        error: { name: "MessageValidationError" },
      });

      // CLEANUP
      await client.close();
    });

    it("should publish with options", async ({ amqpConnectionUrl, initConsumer }) => {
      // GIVEN
      const TestMessage = z.object({
        content: z.string(),
      });

      const exchange = defineExchange("test-options-exchange", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        publishers: {
          testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
            routingKey: "test.key",
          }),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      const pendingMessages = await initConsumer(
        contract.publishers.testPublisher.exchange.name,
        contract.publishers.testPublisher.routingKey,
      );

      // WHEN
      const result = await client.publish(
        "testPublisher",
        { content: "test message" },
        { headers: { test: "value" } },
      );

      // THEN
      expect(result).toEqual(Result.Ok(true));

      await expect(pendingMessages()).resolves.toEqual([
        expect.objectContaining({
          content: Buffer.from(JSON.stringify({ content: "test message" })),
          properties: expect.objectContaining({
            headers: { test: "value" },
          }),
        }),
      ]);

      // CLEANUP
      await client.close();
    });
  });

  describe("topology setup", () => {
    it("should setup exchanges, queues, and bindings", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });

      const exchange = defineExchange("integration-orders", "topic", { durable: false });
      const queue = defineQueue("integration-processing", { durable: false });

      const contract = defineContract({
        exchanges: {
          orders: exchange,
        },
        queues: {
          processing: queue,
        },
        bindings: {
          orderBinding: defineQueueBinding(queue, exchange, {
            routingKey: "order.#",
          }),
        },
        publishers: {
          createOrder: definePublisher(exchange, defineMessage(TestMessage), {
            routingKey: "order.created",
          }),
        },
      });

      // WHEN
      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      // THEN
      expect(client).toBeDefined();

      // CLEANUP
      await client.close();
    });

    it("should handle exchange-to-exchange bindings", async ({
      amqpConnectionUrl,
      initConsumer,
    }) => {
      // GIVEN
      const sourceExchange = defineExchange("integration-source", "topic", { durable: false });
      const destExchange = defineExchange("integration-dest", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          source: sourceExchange,
          dest: destExchange,
        },
        bindings: {
          exchangeBinding: defineExchangeBinding(destExchange, sourceExchange, {
            routingKey: "*.important",
          }),
        },
        publishers: {
          sendMessage: definePublisher(
            sourceExchange,
            defineMessage(z.object({ msg: z.string() })),
            {
              routingKey: "test.important",
            },
          ),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      // Setup consumer on destination exchange
      const pendingMessages = await initConsumer("integration-dest", "test.important");

      // WHEN
      await client.publish("sendMessage", { msg: "routed" });

      // THEN
      const messages = await pendingMessages();
      expect(messages).toHaveLength(1);
      expect(JSON.parse(messages[0].content.toString())).toEqual({ msg: "routed" });

      // CLEANUP
      await client.close();
    });

    it("should handle fanout exchange topology", async ({
      amqpConnectionUrl,
      initConsumer,
    }) => {
      // GIVEN
      const fanoutExchange = defineExchange("integration-fanout", "fanout", { durable: false });
      const queue = defineQueue("integration-fanout-queue", { durable: false });

      const contract = defineContract({
        exchanges: {
          fanout: fanoutExchange,
        },
        queues: {
          fanoutQueue: queue,
        },
        bindings: {
          fanoutBinding: defineQueueBinding(queue, fanoutExchange),
        },
        publishers: {
          broadcast: definePublisher(
            fanoutExchange,
            defineMessage(z.object({ data: z.string() })),
            {},
          ),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      const pendingMessages = await initConsumer("integration-fanout", "");

      // WHEN
      await client.publish("broadcast", { data: "broadcast message" });

      // THEN
      const messages = await pendingMessages();
      expect(messages).toHaveLength(1);
      expect(JSON.parse(messages[0].content.toString())).toEqual({ data: "broadcast message" });

      // CLEANUP
      await client.close();
    });
  });

  describe("connection management", () => {
    it("should close cleanly", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const exchange = defineExchange("integration-close-test", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        publishers: {
          testPublisher: definePublisher(
            exchange,
            defineMessage(z.object({ id: z.string() })),
            {
              routingKey: "test.key",
            },
          ),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      // WHEN
      const closeResult = await client.close();

      // THEN
      expect(closeResult.isOk()).toBe(true);
    });

    it("should handle multiple close calls gracefully", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const exchange = defineExchange("integration-multi-close", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      // WHEN
      await client.close();
      const secondCloseResult = await client.close();

      // THEN
      expect(secondCloseResult.isOk()).toBe(true);
    });

    it("should publish after connection", async ({ amqpConnectionUrl, initConsumer }) => {
      // GIVEN
      const exchange = defineExchange("integration-post-connect", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        publishers: {
          testPublisher: definePublisher(
            exchange,
            defineMessage(z.object({ value: z.number() })),
            {
              routingKey: "test.value",
            },
          ),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      const pendingMessages = await initConsumer("integration-post-connect", "test.value");

      // WHEN
      const result = await client.publish("testPublisher", { value: 42 });

      // THEN
      expect(result.isOk()).toBe(true);
      const messages = await pendingMessages();
      expect(messages).toHaveLength(1);
      expect(JSON.parse(messages[0].content.toString())).toEqual({ value: 42 });

      // CLEANUP
      await client.close();
    });
  });

  describe("error handling", () => {
    it("should validate message schema and return error", async ({ amqpConnectionUrl }) => {
      // GIVEN
      const TestMessage = z.object({
        id: z.string(),
        count: z.number().positive(),
      });

      const exchange = defineExchange("integration-validation-error", "topic", { durable: false });

      const contract = defineContract({
        exchanges: {
          test: exchange,
        },
        publishers: {
          testPublisher: definePublisher(exchange, defineMessage(TestMessage), {
            routingKey: "validation.test",
          }),
        },
      });

      const client = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      }).resultToPromise();

      // WHEN - Invalid data (count must be positive)
      const result = await client.publish("testPublisher", {
        id: "123",
        // @ts-expect-error - testing runtime validation
        count: "not-a-number",
      });

      // THEN
      expect(result.isError()).toBe(true);
      if (result.isError()) {
        expect(result.error.name).toBe("MessageValidationError");
      }

      // CLEANUP
      await client.close();
    });
  });
});
