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
      const exchange = defineExchange("test-exchange", "topic", {
        durable: true,
      });

      expect(exchange).toEqual({
        name: "test-exchange",
        type: "topic",
        durable: true,
      });
    });

    it("should create an exchange with minimal options", () => {
      const exchange = defineExchange("test-exchange", "fanout");

      expect(exchange).toEqual({
        name: "test-exchange",
        type: "fanout",
      });
    });
  });

  describe("defineQueue", () => {
    it("should create a queue definition", () => {
      const queue = defineQueue("test-queue", { durable: true });

      expect(queue).toEqual({
        name: "test-queue",
        durable: true,
      });
    });

    it("should create a queue with minimal options", () => {
      const queue = defineQueue("test-queue");

      expect(queue).toEqual({
        name: "test-queue",
      });
    });
  });

  describe("defineBinding", () => {
    it("should create a binding definition", () => {
      const binding = defineBinding("test-queue", "test-exchange", {
        routingKey: "test.key",
      });

      expect(binding).toEqual({
        queue: "test-queue",
        exchange: "test-exchange",
        routingKey: "test.key",
      });
    });

    it("should create a binding with minimal options", () => {
      const binding = defineBinding("test-queue", "test-exchange");

      expect(binding).toEqual({
        queue: "test-queue",
        exchange: "test-exchange",
      });
    });
  });

  describe("definePublisher", () => {
    it("should create a publisher definition", () => {
      const schema = z.object({ id: z.string() });
      const publisher = definePublisher("test-exchange", schema, {
        routingKey: "test.key",
      });

      expect(publisher).toEqual({
        exchange: "test-exchange",
        message: schema,
        routingKey: "test.key",
      });
    });

    it("should create a publisher with minimal options", () => {
      const schema = z.object({ id: z.string() });
      const publisher = definePublisher("test-exchange", schema);

      expect(publisher).toEqual({
        exchange: "test-exchange",
        message: schema,
      });
    });
  });

  describe("defineConsumer", () => {
    it("should create a consumer definition", () => {
      const schema = z.object({ id: z.string() });
      const consumer = defineConsumer("test-queue", schema, {
        prefetch: 10,
      });

      expect(consumer).toEqual({
        queue: "test-queue",
        message: schema,
        prefetch: 10,
      });
    });

    it("should create a consumer with minimal options", () => {
      const schema = z.object({ id: z.string() });
      const consumer = defineConsumer("test-queue", schema);

      expect(consumer).toEqual({
        queue: "test-queue",
        message: schema,
      });
    });
  });

  describe("defineContract", () => {
    it("should create a complete contract", () => {
      const messageSchema = z.object({
        orderId: z.string(),
        amount: z.number(),
      });

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

      expect(contract).toBeDefined();
      expect(contract.exchanges?.orders.name).toBe("orders");
      expect(contract.queues?.orderProcessing.name).toBe("order-processing");
      expect(contract.publishers?.orderCreated.exchange).toBe("orders");
      expect(contract.consumers?.processOrder.queue).toBe("order-processing");
    });

    it("should create a minimal contract", () => {
      const contract = defineContract({});

      expect(contract).toEqual({});
    });
  });
});
