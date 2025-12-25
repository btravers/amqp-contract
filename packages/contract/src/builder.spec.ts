import {
  defineConsumer,
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  mergeContracts,
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

  describe("mergeContracts", () => {
    it("should merge two contracts with different resources", () => {
      // GIVEN
      const orderMessage = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const paymentMessage = defineMessage(
        z.object({
          paymentId: z.string(),
          amount: z.number(),
        }),
      );

      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const paymentsExchange = defineExchange("payments", "topic", { durable: true });

      const orderQueue = defineQueue("order-processing", { durable: true });
      const paymentQueue = defineQueue("payment-processing", { durable: true });

      const orderContract = defineContract({
        exchanges: {
          orders: ordersExchange,
        },
        queues: {
          orderProcessing: orderQueue,
        },
        bindings: {
          orderBinding: defineQueueBinding(orderQueue, ordersExchange, {
            routingKey: "order.created",
          }),
        },
        publishers: {
          orderCreated: definePublisher(ordersExchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(orderQueue, orderMessage),
        },
      });

      const paymentContract = defineContract({
        exchanges: {
          payments: paymentsExchange,
        },
        queues: {
          paymentProcessing: paymentQueue,
        },
        bindings: {
          paymentBinding: defineQueueBinding(paymentQueue, paymentsExchange, {
            routingKey: "payment.received",
          }),
        },
        publishers: {
          paymentReceived: definePublisher(paymentsExchange, paymentMessage, {
            routingKey: "payment.received",
          }),
        },
        consumers: {
          processPayment: defineConsumer(paymentQueue, paymentMessage),
        },
      });

      // WHEN
      const merged = mergeContracts(orderContract, paymentContract);

      // THEN
      expect(merged).toMatchObject({
        exchanges: {
          orders: ordersExchange,
          payments: paymentsExchange,
        },
        queues: {
          orderProcessing: orderQueue,
          paymentProcessing: paymentQueue,
        },
        bindings: {
          orderBinding: {
            type: "queue",
            queue: orderQueue,
            exchange: ordersExchange,
            routingKey: "order.created",
          },
          paymentBinding: {
            type: "queue",
            queue: paymentQueue,
            exchange: paymentsExchange,
            routingKey: "payment.received",
          },
        },
        publishers: {
          orderCreated: {
            exchange: ordersExchange,
            message: orderMessage,
            routingKey: "order.created",
          },
          paymentReceived: {
            exchange: paymentsExchange,
            message: paymentMessage,
            routingKey: "payment.received",
          },
        },
        consumers: {
          processOrder: {
            queue: orderQueue,
            message: orderMessage,
          },
          processPayment: {
            queue: paymentQueue,
            message: paymentMessage,
          },
        },
      });
    });

    it("should merge multiple contracts", () => {
      // GIVEN
      const exchange1 = defineExchange("exchange-1", "topic", { durable: true });
      const exchange2 = defineExchange("exchange-2", "topic", { durable: true });
      const exchange3 = defineExchange("exchange-3", "topic", { durable: true });

      const contract1 = defineContract({
        exchanges: { ex1: exchange1 },
      });

      const contract2 = defineContract({
        exchanges: { ex2: exchange2 },
      });

      const contract3 = defineContract({
        exchanges: { ex3: exchange3 },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2, contract3);

      // THEN
      expect(merged).toMatchObject({
        exchanges: {
          ex1: exchange1,
          ex2: exchange2,
          ex3: exchange3,
        },
      });
    });

    it("should handle empty contracts", () => {
      // GIVEN
      const emptyContract1 = defineContract({});
      const emptyContract2 = defineContract({});

      const exchange = defineExchange("test", "topic", { durable: true });
      const fullContract = defineContract({
        exchanges: { test: exchange },
      });

      // WHEN
      const merged = mergeContracts(emptyContract1, fullContract, emptyContract2);

      // THEN
      expect(merged).toMatchObject({
        exchanges: {
          test: exchange,
        },
      });
    });

    it("should override resources with same name (later contracts win)", () => {
      // GIVEN
      const exchange1 = defineExchange("shared-exchange", "topic", { durable: true });
      const exchange2 = defineExchange("shared-exchange", "direct", { durable: false });

      const contract1 = defineContract({
        exchanges: { shared: exchange1 },
      });

      const contract2 = defineContract({
        exchanges: { shared: exchange2 },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2);

      // THEN
      expect(merged.exchanges?.["shared"]).toEqual({
        name: "shared-exchange",
        type: "direct",
        durable: false,
      });
    });

    it("should merge contracts with partial resource definitions", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("test-exchange", "topic", { durable: true });
      const queue = defineQueue("test-queue", { durable: true });

      const contractWithExchanges = defineContract({
        exchanges: { test: exchange },
      });

      const contractWithQueues = defineContract({
        queues: { test: queue },
      });

      const contractWithPublishers = defineContract({
        publishers: {
          testPublisher: definePublisher(exchange, message, {
            routingKey: "test.key",
          }),
        },
      });

      // WHEN
      const merged = mergeContracts(
        contractWithExchanges,
        contractWithQueues,
        contractWithPublishers,
      );

      // THEN
      expect(merged).toMatchObject({
        exchanges: { test: exchange },
        queues: { test: queue },
        publishers: {
          testPublisher: {
            exchange,
            message,
            routingKey: "test.key",
          },
        },
      });
    });

    it("should return empty contract when merging only empty contracts", () => {
      // GIVEN
      const empty1 = defineContract({});
      const empty2 = defineContract({});
      const empty3 = defineContract({});

      // WHEN
      const merged = mergeContracts(empty1, empty2, empty3);

      // THEN
      expect(merged).toEqual({});
    });

    it("should handle single contract merge", () => {
      // GIVEN
      const exchange = defineExchange("test", "topic", { durable: true });
      const contract = defineContract({
        exchanges: { test: exchange },
      });

      // WHEN
      const merged = mergeContracts(contract);

      // THEN
      expect(merged).toMatchObject({
        exchanges: { test: exchange },
      });
    });

    it("should merge contracts with all resource types", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("test-exchange", "topic", { durable: true });
      const queue = defineQueue("test-queue", { durable: true });

      const contract1 = defineContract({
        exchanges: { ex1: exchange },
        queues: { q1: queue },
      });

      const contract2 = defineContract({
        bindings: {
          b1: defineQueueBinding(queue, exchange, {
            routingKey: "test.key",
          }),
        },
        publishers: {
          p1: definePublisher(exchange, message, {
            routingKey: "test.key",
          }),
        },
      });

      const contract3 = defineContract({
        consumers: {
          c1: defineConsumer(queue, message),
        },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2, contract3);

      // THEN
      expect(merged).toMatchObject({
        exchanges: { ex1: exchange },
        queues: { q1: queue },
        bindings: {
          b1: {
            type: "queue",
            queue,
            exchange,
            routingKey: "test.key",
          },
        },
        publishers: {
          p1: {
            exchange,
            message,
            routingKey: "test.key",
          },
        },
        consumers: {
          c1: {
            queue,
            message,
          },
        },
      });
    });

    it("should preserve order when merging overlapping publishers", () => {
      // GIVEN
      const message1 = defineMessage(z.object({ id: z.string() }));
      const message2 = defineMessage(z.object({ value: z.number() }));
      const exchange = defineExchange("test", "topic", { durable: true });

      const contract1 = defineContract({
        publishers: {
          pub1: definePublisher(exchange, message1, { routingKey: "first" }),
          shared: definePublisher(exchange, message1, { routingKey: "v1" }),
        },
      });

      const contract2 = defineContract({
        publishers: {
          pub2: definePublisher(exchange, message2, { routingKey: "second" }),
          shared: definePublisher(exchange, message2, { routingKey: "v2" }),
        },
      });

      // WHEN
      const merged = mergeContracts(contract1, contract2);

      // THEN
      expect(merged.publishers).toBeDefined();
      expect(Object.keys(merged.publishers ?? {})).toEqual(["pub1", "shared", "pub2"]);
      expect(merged.publishers?.["shared"]).toEqual({
        exchange,
        message: message2,
        routingKey: "v2",
      });
    });
  });
});
