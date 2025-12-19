import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { createClient } from "./client.js";
import { defineContract, defineExchange, definePublisher } from "@amqp-contract/contract";
import { z } from "zod";

describe("AmqpClient Integration", () => {
  describe("end-to-end publishing", () => {
    it("should publish messages to a real RabbitMQ instance", async ({ clientConnection }) => {
      // GIVEN
      const TestMessage = z.object({
        id: z.string(),
        message: z.string(),
      });

      const contract = defineContract({
        exchanges: {
          test: defineExchange("test-exchange", "topic", { durable: false }),
        },
        publishers: {
          testPublisher: definePublisher("test-exchange", TestMessage, {
            routingKey: "test.key",
          }),
        },
      });

      const client = createClient(contract);
      await client.connect(clientConnection);

      // WHEN
      const result = await client.publish("testPublisher", {
        id: "123",
        message: "Hello, RabbitMQ!",
      });

      // THEN
      expect(result).toBe(true);

      // CLEANUP
      await client.close();
    });

    it("should validate messages before publishing", async ({ clientConnection }) => {
      // GIVEN
      const TestMessage = z.object({
        id: z.string(),
        count: z.number().positive(),
      });

      const contract = defineContract({
        exchanges: {
          test: defineExchange("test-validation-exchange", "topic", { durable: false }),
        },
        publishers: {
          testPublisher: definePublisher("test-validation-exchange", TestMessage, {
            routingKey: "validation.test",
          }),
        },
      });

      const client = createClient(contract);
      await client.connect(clientConnection);

      // WHEN / THEN
      await expect(
        client.publish("testPublisher", {
          id: "123",
          count: -5, // Invalid: count must be positive
        }),
      ).rejects.toThrow();

      // CLEANUP
      await client.close();
    });

    it("should handle custom routing keys", async ({ clientConnection }) => {
      // GIVEN
      const TestMessage = z.object({
        content: z.string(),
      });

      const contract = defineContract({
        exchanges: {
          test: defineExchange("test-routing-exchange", "topic", { durable: false }),
        },
        publishers: {
          testPublisher: definePublisher("test-routing-exchange", TestMessage, {
            routingKey: "default.key",
          }),
        },
      });

      const client = createClient(contract);
      await client.connect(clientConnection);

      // WHEN
      const result = await client.publish(
        "testPublisher",
        { content: "test message" },
        { routingKey: "custom.key" },
      );

      // THEN
      expect(result).toBe(true);

      // CLEANUP
      await client.close();
    });
  });

  describe("topology setup", () => {
    it("should setup exchanges, queues, and bindings", async ({ clientConnection }) => {
      // GIVEN
      const TestMessage = z.object({ id: z.string() });

      const contract = defineContract({
        exchanges: {
          orders: defineExchange("integration-orders", "topic", { durable: false }),
        },
        queues: {
          processing: {
            name: "integration-processing",
            durable: false,
          },
        },
        bindings: {
          orderBinding: {
            queue: "integration-processing",
            exchange: "integration-orders",
            routingKey: "order.#",
          },
        },
        publishers: {
          createOrder: definePublisher("integration-orders", TestMessage, {
            routingKey: "order.created",
          }),
        },
      });

      const client = createClient(contract);

      // WHEN
      await client.connect(clientConnection);

      // THEN - No errors should be thrown during topology setup
      expect(client).toBeDefined();

      // CLEANUP
      await client.close();
    });
  });
});
