import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "./builder.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

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

  describe("defineQueueBinding", () => {
    it("should create a queue binding definition", () => {
      // GIVEN
      const queue = defineQueue("test-queue");
      const exchange = defineExchange("test-exchange", "topic");

      // WHEN
      const binding = defineQueueBinding(queue, exchange, {
        routingKey: "test.key",
      });

      // THEN
      expect(binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "test.key",
      });
    });

    it("should create a queue binding with minimal options", () => {
      // GIVEN
      const queue = defineQueue("test-queue");
      const exchange = defineExchange("test-exchange", "fanout");

      // WHEN
      const binding = defineQueueBinding(queue, exchange);

      // THEN
      expect(binding).toEqual({
        type: "queue",
        queue,
        exchange,
      });
    });
  });

  describe("defineExchangeBinding", () => {
    it("should create an exchange binding definition", () => {
      // GIVEN
      const destination = defineExchange("destination-exchange", "topic");
      const source = defineExchange("source-exchange", "topic");

      // WHEN
      const binding = defineExchangeBinding(destination, source, {
        routingKey: "test.key",
      });

      // THEN
      expect(binding).toEqual({
        type: "exchange",
        destination,
        source,
        routingKey: "test.key",
      });
    });

    it("should create an exchange binding with minimal options", () => {
      // GIVEN
      const destination = defineExchange("destination-exchange", "fanout");
      const source = defineExchange("source-exchange", "fanout");

      // WHEN
      const binding = defineExchangeBinding(destination, source);

      // THEN
      expect(binding).toEqual({
        type: "exchange",
        destination,
        source,
      });
    });

    it("should create an exchange binding with arguments", () => {
      // GIVEN
      const destination = defineExchange("destination-exchange", "topic");
      const source = defineExchange("source-exchange", "topic");

      // WHEN
      const binding = defineExchangeBinding(destination, source, {
        routingKey: "order.*",
        arguments: { "x-match": "any" },
      });

      // THEN
      expect(binding).toEqual({
        type: "exchange",
        destination,
        source,
        routingKey: "order.*",
        arguments: { "x-match": "any" },
      });
    });
  });

  describe("defineMessage", () => {
    it("should create a message definition with payload only", () => {
      // GIVEN
      const payload = z.object({
        id: z.string(),
        name: z.string(),
      });

      // WHEN
      const message = defineMessage(payload);

      // THEN
      expect(message).toEqual({
        payload,
      });
    });

    it("should create a message definition with payload and summary", () => {
      // GIVEN
      const payload = z.object({
        orderId: z.string(),
        amount: z.number(),
      });

      // WHEN
      const message = defineMessage(payload, {
        summary: "Order created event",
      });

      // THEN
      expect(message).toEqual({
        payload,
        summary: "Order created event",
      });
    });

    it("should create a message definition with payload, summary and description", () => {
      // GIVEN
      const payload = z.object({
        userId: z.string(),
        email: z.string().email(),
      });

      // WHEN
      const message = defineMessage(payload, {
        summary: "User registered event",
        description: "Emitted when a new user registers in the system",
      });

      // THEN
      expect(message).toEqual({
        payload,
        summary: "User registered event",
        description: "Emitted when a new user registers in the system",
      });
    });

    it("should create a message definition with headers", () => {
      // GIVEN
      const payload = z.object({
        orderId: z.string(),
      });
      const headers = z.object({
        "x-correlation-id": z.string(),
        "x-request-id": z.string(),
      });

      // WHEN
      const message = defineMessage(payload, {
        headers,
        summary: "Order event with headers",
      });

      // THEN
      expect(message).toEqual({
        payload,
        headers,
        summary: "Order event with headers",
      });
    });
  });

  describe("definePublisher", () => {
    it("should create a publisher definition", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("test-exchange", "topic");

      // WHEN
      const publisher = definePublisher(exchange, message, {
        routingKey: "test.key",
      });

      // THEN
      expect(publisher).toEqual({
        exchange,
        message,
        routingKey: "test.key",
      });
    });

    it("should create a publisher with minimal options", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("test-exchange", "fanout");

      // WHEN
      const publisher = definePublisher(exchange, message);

      // THEN
      expect(publisher).toEqual({
        exchange,
        message,
      });
    });
  });

  describe("defineConsumer", () => {
    it("should create a consumer definition", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");

      // WHEN
      const consumer = defineConsumer(queue, message);

      // THEN
      expect(consumer).toEqual({
        queue,
        message,
      });
    });

    it("should create a consumer with minimal options", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");

      // WHEN
      const consumer = defineConsumer(queue, message);

      // THEN
      expect(consumer).toEqual({
        queue,
        message,
      });
    });

    it("should create a consumer with error handling strategy", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");
      const dlxExchange = defineExchange("dlx", "direct", { durable: true });
      const retryQueue = defineQueue("retry-queue", { durable: true });

      // WHEN
      const consumer = defineConsumer(queue, message, {
        errorHandling: {
          deadLetterExchange: dlxExchange,
          retryQueue: retryQueue,
          exponentialBackoff: {
            initialDelayMs: 1000,
            multiplier: 2,
            maxAttempts: 3,
            maxDelayMs: 60000,
          },
        },
      });

      // THEN
      expect(consumer).toEqual({
        queue,
        message,
        errorHandling: {
          deadLetterExchange: dlxExchange,
          retryQueue: retryQueue,
          exponentialBackoff: {
            initialDelayMs: 1000,
            multiplier: 2,
            maxAttempts: 3,
            maxDelayMs: 60000,
          },
        },
      });
    });

    it("should create a consumer with minimal error handling (only dead letter exchange)", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");
      const dlxExchange = defineExchange("dlx", "direct", { durable: true });

      // WHEN
      const consumer = defineConsumer(queue, message, {
        errorHandling: {
          deadLetterExchange: dlxExchange,
        },
      });

      // THEN
      expect(consumer).toEqual({
        queue,
        message,
        errorHandling: {
          deadLetterExchange: dlxExchange,
        },
      });
    });
  });

  describe("defineContract", () => {
    it("should create a complete contract", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const orderProcessingQueue = defineQueue("order-processing", { durable: true });

      // WHEN
      const contract = defineContract({
        exchanges: {
          orders: ordersExchange,
        },
        queues: {
          orderProcessing: orderProcessingQueue,
        },
        bindings: {
          orderBinding: defineQueueBinding(orderProcessingQueue, ordersExchange, {
            routingKey: "order.created",
          }),
        },
        publishers: {
          orderCreated: definePublisher(ordersExchange, message, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(orderProcessingQueue, message),
        },
      });

      // THEN
      expect(contract).toMatchObject({
        exchanges: {
          orders: { name: "orders", type: "topic", durable: true },
        },
        queues: {
          orderProcessing: { name: "order-processing", durable: true },
        },
        bindings: {
          orderBinding: {
            type: "queue",
            queue: orderProcessingQueue,
            exchange: ordersExchange,
            routingKey: "order.created",
          },
        },
        publishers: {
          orderCreated: {
            exchange: ordersExchange,
            message,
            routingKey: "order.created",
          },
        },
        consumers: {
          processOrder: {
            queue: orderProcessingQueue,
            message,
          },
        },
      });
    });

    it("should create a minimal contract", () => {
      // WHEN
      const contract = defineContract({});

      // THEN
      expect(contract).toEqual({});
    });

    it("should create a contract with exchange-to-exchange bindings", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const sourceExchange = defineExchange("source-exchange", "topic", { durable: true });
      const destinationExchange = defineExchange("destination-exchange", "topic", {
        durable: true,
      });
      const finalQueue = defineQueue("final-queue", { durable: true });

      // WHEN
      const contract = defineContract({
        exchanges: {
          sourceExchange,
          destinationExchange,
        },
        queues: {
          finalQueue,
        },
        bindings: {
          exchangeToExchange: defineExchangeBinding(destinationExchange, sourceExchange, {
            routingKey: "order.*",
          }),
          queueBinding: defineQueueBinding(finalQueue, destinationExchange, {
            routingKey: "order.created",
          }),
        },
        publishers: {
          orderCreated: definePublisher(sourceExchange, message, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(finalQueue, message),
        },
      });

      // THEN
      expect(contract).toMatchObject({
        exchanges: {
          sourceExchange: { name: "source-exchange" },
          destinationExchange: { name: "destination-exchange" },
        },
        bindings: {
          exchangeToExchange: {
            type: "exchange",
            source: sourceExchange,
            destination: destinationExchange,
          },
          queueBinding: {
            type: "queue",
            queue: finalQueue,
            exchange: destinationExchange,
          },
        },
      });
    });
  });
});
