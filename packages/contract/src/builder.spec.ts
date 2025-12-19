import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineBinding,
  defineConsumer,
  defineContract,
  defineExchange,
  definePublisher,
  defineQueue,
} from "./builder.js";

describe("builder", () => {
  describe("defineExchange", () => {
    it("should create an exchange definition", () => {
      // WHEN
      const exchange = defineExchange("test-exchange", "topic", {
        durable: true,
      });

      // THEN
      expect(exchange).toEqual({
        name: "test-exchange",
        type: "topic",
        durable: true,
      });
    });

    it("should create an exchange with minimal options", () => {
      // WHEN
      const exchange = defineExchange("test-exchange", "fanout");

      // THEN
      expect(exchange).toEqual({
        name: "test-exchange",
        type: "fanout",
      });
    });
  });

  describe("defineQueue", () => {
    it("should create a queue definition", () => {
      // WHEN
      const queue = defineQueue("test-queue", { durable: true });

      // THEN
      expect(queue).toEqual({
        name: "test-queue",
        durable: true,
      });
    });

    it("should create a queue with minimal options", () => {
      // WHEN
      const queue = defineQueue("test-queue");

      // THEN
      expect(queue).toEqual({
        name: "test-queue",
      });
    });
  });

  describe("defineBinding", () => {
    it("should create a binding definition", () => {
      // WHEN
      const binding = defineBinding("test-queue", "test-exchange", {
        routingKey: "test.key",
      });

      // THEN
      expect(binding).toEqual({
        queue: "test-queue",
        exchange: "test-exchange",
        routingKey: "test.key",
      });
    });

    it("should create a binding with minimal options", () => {
      // WHEN
      const binding = defineBinding("test-queue", "test-exchange");

      // THEN
      expect(binding).toEqual({
        queue: "test-queue",
        exchange: "test-exchange",
      });
    });
  });

  describe("definePublisher", () => {
    it("should create a publisher definition", () => {
      // GIVEN
      const schema = z.object({ id: z.string() });

      // WHEN
      const publisher = definePublisher("test-exchange", schema, {
        routingKey: "test.key",
      });

      // THEN
      expect(publisher).toEqual({
        exchange: "test-exchange",
        message: schema,
        routingKey: "test.key",
      });
    });

    it("should create a publisher with minimal options", () => {
      // GIVEN
      const schema = z.object({ id: z.string() });

      // WHEN
      const publisher = definePublisher("test-exchange", schema);

      // THEN
      expect(publisher).toEqual({
        exchange: "test-exchange",
        message: schema,
      });
    });
  });

  describe("defineConsumer", () => {
    it("should create a consumer definition", () => {
      // GIVEN
      const schema = z.object({ id: z.string() });

      // WHEN
      const consumer = defineConsumer("test-queue", schema, {
        prefetch: 10,
      });

      // THEN
      expect(consumer).toEqual({
        queue: "test-queue",
        message: schema,
        prefetch: 10,
      });
    });

    it("should create a consumer with minimal options", () => {
      // GIVEN
      const schema = z.object({ id: z.string() });

      // WHEN
      const consumer = defineConsumer("test-queue", schema);

      // THEN
      expect(consumer).toEqual({
        queue: "test-queue",
        message: schema,
      });
    });
  });

  describe("defineContract", () => {
    it("should create a complete contract", () => {
      // GIVEN
      const messageSchema = z.object({
        orderId: z.string(),
        amount: z.number(),
      });

      // WHEN
      const contract = defineContract({
        exchanges: {
          orders: defineExchange("orders", "topic", { durable: true }),
        },
        queues: {
          orderProcessing: defineQueue("order-processing", { durable: true }),
        },
        bindings: {
          orderBinding: defineBinding("order-processing", "orders", {
            routingKey: "order.created",
          }),
        },
        publishers: {
          orderCreated: definePublisher("orders", messageSchema, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer("order-processing", messageSchema, {
            prefetch: 10,
          }),
        },
      });

      // THEN
      expect(contract).toBeDefined();
      expect(contract.exchanges?.orders.name).toBe("orders");
      expect(contract.queues?.orderProcessing.name).toBe("order-processing");
      expect(contract.publishers?.orderCreated.exchange).toBe("orders");
      expect(contract.consumers?.processOrder.queue).toBe("order-processing");
    });

    it("should create a minimal contract", () => {
      // WHEN
      const contract = defineContract({});

      // THEN
      expect(contract).toEqual({});
    });
  });
});
