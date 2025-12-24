import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { TypedAmqpClient } from "./client.js";
import {
  defineContract,
  defineExchange,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  defineMessage,
} from "@amqp-contract/contract";
import { Result } from "@swan-io/boxed";
import { z } from "zod";

describe("AmqpClient Integration", () => {
  describe("end-to-end publishing", () => {
    it("should publish messages to a real RabbitMQ instance", async ({ amqpConnectionUrl }) => {
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

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

      // WHEN
      const result = await client.publish("testPublisher", {
        id: "123",
        message: "Hello, RabbitMQ!",
      });

      // THEN
      expect(result).toEqual(Result.Ok(true));

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

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

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

    it("should publish with options", async ({ amqpConnectionUrl }) => {
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

      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

      // WHEN
      const result = await client.publish(
        "testPublisher",
        { content: "test message" },
        { persistent: true },
      );

      // THEN
      expect(result).toEqual(Result.Ok(true));

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
      const clientResult = await TypedAmqpClient.create({
        contract,
        urls: [amqpConnectionUrl],
      });

      // THEN - No errors should be thrown during topology setup
      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;
      expect(client).toBeDefined();

      // CLEANUP
      await client.close();
    });
  });
});
