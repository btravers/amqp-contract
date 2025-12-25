import {
  defineConsumer,
  defineConsumerFirst,
  defineContract,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  definePublisherFirst,
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

  describe("definePublisherFirst", () => {
    it("should create a publisher-first relationship with fanout exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("test-exchange", "fanout");
      const queue = defineQueue("test-queue");

      // WHEN
      const result = definePublisherFirst(exchange, queue, message);

      // THEN
      expect(result.publisher).toEqual({
        exchange,
        message,
      });
      expect(result.binding).toEqual({
        type: "queue",
        queue,
        exchange,
      });
      expect(result.createConsumer()).toEqual({
        queue,
        message,
      });
    });

    it("should create a publisher-first relationship with topic exchange", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const exchange = defineExchange("orders", "topic", { durable: true });
      const queue = defineQueue("order-processing", { durable: true });

      // WHEN
      const result = definePublisherFirst(exchange, queue, message, {
        routingKey: "order.created",
      });

      // THEN
      expect(result.publisher).toEqual({
        exchange,
        message,
        routingKey: "order.created",
      });
      expect(result.binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "order.created",
      });
      expect(result.createConsumer()).toEqual({
        queue,
        message,
      });
    });

    it("should create a publisher-first relationship with direct exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ taskId: z.string() }));
      const exchange = defineExchange("tasks", "direct");
      const queue = defineQueue("task-queue");

      // WHEN
      const result = definePublisherFirst(exchange, queue, message, {
        routingKey: "task.execute",
      });

      // THEN
      expect(result.publisher).toEqual({
        exchange,
        message,
        routingKey: "task.execute",
      });
      expect(result.binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "task.execute",
      });
      expect(result.createConsumer()).toEqual({
        queue,
        message,
      });
    });

    it("should ensure routing key consistency between publisher and binding", () => {
      // GIVEN
      const message = defineMessage(z.object({ data: z.string() }));
      const exchange = defineExchange("events", "topic");
      const queue = defineQueue("event-queue");

      // WHEN
      const result = definePublisherFirst(exchange, queue, message, {
        routingKey: "event.created",
      });

      // THEN - Routing key should be the same in both publisher and binding
      expect(result.publisher.routingKey).toBe("event.created");
      expect(result.binding.routingKey).toBe("event.created");
    });

    it("should ensure message consistency between publisher and consumer", () => {
      // GIVEN
      const message = defineMessage(z.object({ userId: z.string() }));
      const exchange = defineExchange("users", "fanout");
      const queue = defineQueue("user-queue");

      // WHEN
      const result = definePublisherFirst(exchange, queue, message);
      const consumer = result.createConsumer();

      // THEN - Message should be the same object reference
      expect(result.publisher.message).toBe(message);
      expect(consumer.message).toBe(message);
    });

    it("should work in a complete contract with publisher-first pattern", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const orderQueue = defineQueue("order-processing", { durable: true });

      // WHEN
      const orderPublisherFirst = definePublisherFirst(ordersExchange, orderQueue, message, {
        routingKey: "order.created",
      });

      const contract = defineContract({
        exchanges: {
          orders: ordersExchange,
        },
        queues: {
          orderProcessing: orderQueue,
        },
        bindings: {
          orderBinding: orderPublisherFirst.binding,
        },
        publishers: {
          orderCreated: orderPublisherFirst.publisher,
        },
        consumers: {
          processOrder: orderPublisherFirst.createConsumer(),
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
            queue: orderQueue,
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
            queue: orderQueue,
            message,
          },
        },
      });
    });
  });

  describe("defineConsumerFirst", () => {
    it("should create a consumer-first relationship with fanout exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");
      const exchange = defineExchange("test-exchange", "fanout");

      // WHEN
      const result = defineConsumerFirst(queue, exchange, message);

      // THEN
      expect(result.consumer).toEqual({
        queue,
        message,
      });
      expect(result.binding).toEqual({
        type: "queue",
        queue,
        exchange,
      });
      expect(result.createPublisher()).toEqual({
        exchange,
        message,
      });
    });

    it("should create a consumer-first relationship with topic exchange", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          taskId: z.string(),
          payload: z.record(z.string(), z.unknown()),
        }),
      );
      const queue = defineQueue("tasks", { durable: true });
      const exchange = defineExchange("tasks", "direct", { durable: true });

      // WHEN
      const result = defineConsumerFirst(queue, exchange, message, {
        routingKey: "task.execute",
      });

      // THEN
      expect(result.consumer).toEqual({
        queue,
        message,
      });
      expect(result.binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "task.execute",
      });
      expect(result.createPublisher()).toEqual({
        exchange,
        message,
        routingKey: "task.execute",
      });
    });

    it("should create a consumer-first relationship with direct exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ notificationId: z.string() }));
      const queue = defineQueue("notifications");
      const exchange = defineExchange("notifications", "direct");

      // WHEN
      const result = defineConsumerFirst(queue, exchange, message, {
        routingKey: "notification.send",
      });

      // THEN
      expect(result.consumer).toEqual({
        queue,
        message,
      });
      expect(result.binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "notification.send",
      });
      expect(result.createPublisher()).toEqual({
        exchange,
        message,
        routingKey: "notification.send",
      });
    });

    it("should ensure routing key consistency between consumer and publisher", () => {
      // GIVEN
      const message = defineMessage(z.object({ eventId: z.string() }));
      const queue = defineQueue("event-queue");
      const exchange = defineExchange("events", "topic");

      // WHEN
      const result = defineConsumerFirst(queue, exchange, message, {
        routingKey: "event.processed",
      });
      const publisher = result.createPublisher();

      // THEN - Routing key should be the same in both binding and publisher
      expect(result.binding.routingKey).toBe("event.processed");
      expect(publisher.routingKey).toBe("event.processed");
    });

    it("should ensure message consistency between consumer and publisher", () => {
      // GIVEN
      const message = defineMessage(z.object({ data: z.string() }));
      const queue = defineQueue("data-queue");
      const exchange = defineExchange("data", "fanout");

      // WHEN
      const result = defineConsumerFirst(queue, exchange, message);
      const publisher = result.createPublisher();

      // THEN - Message should be the same object reference
      expect(result.consumer.message).toBe(message);
      expect(publisher.message).toBe(message);
    });

    it("should work in a complete contract with consumer-first pattern", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          userId: z.string(),
          action: z.string(),
        }),
      );
      const auditQueue = defineQueue("audit-log", { durable: true });
      const auditExchange = defineExchange("audit", "topic", { durable: true });

      // WHEN
      const auditConsumerFirst = defineConsumerFirst(auditQueue, auditExchange, message, {
        routingKey: "audit.log",
      });

      const contract = defineContract({
        exchanges: {
          audit: auditExchange,
        },
        queues: {
          auditLog: auditQueue,
        },
        bindings: {
          auditBinding: auditConsumerFirst.binding,
        },
        publishers: {
          logAudit: auditConsumerFirst.createPublisher(),
        },
        consumers: {
          processAudit: auditConsumerFirst.consumer,
        },
      });

      // THEN
      expect(contract).toMatchObject({
        exchanges: {
          audit: { name: "audit", type: "topic", durable: true },
        },
        queues: {
          auditLog: { name: "audit-log", durable: true },
        },
        bindings: {
          auditBinding: {
            type: "queue",
            queue: auditQueue,
            exchange: auditExchange,
            routingKey: "audit.log",
          },
        },
        publishers: {
          logAudit: {
            exchange: auditExchange,
            message,
            routingKey: "audit.log",
          },
        },
        consumers: {
          processAudit: {
            queue: auditQueue,
            message,
          },
        },
      });
    });
  });

  describe("contract consistency with external resources", () => {
    it("should support using external exchange with publisher-first", () => {
      // GIVEN - External exchange from another contract
      const externalExchange = defineExchange("external-events", "topic", { durable: true });
      const localQueue = defineQueue("local-queue", { durable: true });
      const message = defineMessage(z.object({ eventId: z.string() }));

      // WHEN - Use external exchange with local queue
      const result = definePublisherFirst(externalExchange, localQueue, message, {
        routingKey: "external.event",
      });

      // THEN
      expect(result.publisher.exchange).toBe(externalExchange);
      expect(result.binding.exchange).toBe(externalExchange);
      expect(result.createConsumer().queue).toBe(localQueue);
    });

    it("should support using external queue with consumer-first", () => {
      // GIVEN - External queue from another contract
      const externalQueue = defineQueue("external-queue", { durable: true });
      const localExchange = defineExchange("local-exchange", "direct", { durable: true });
      const message = defineMessage(z.object({ data: z.string() }));

      // WHEN - Use external queue with local exchange
      const result = defineConsumerFirst(externalQueue, localExchange, message, {
        routingKey: "local.route",
      });

      // THEN
      expect(result.consumer.queue).toBe(externalQueue);
      expect(result.binding.queue).toBe(externalQueue);
      expect(result.createPublisher().exchange).toBe(localExchange);
    });

    it("should support mixed external and local resources in a contract", () => {
      // GIVEN - Mix of external and local resources
      const externalExchange = defineExchange("external-exchange", "topic", { durable: true });
      const localQueue = defineQueue("local-queue", { durable: true });
      const sharedMessage = defineMessage(z.object({ id: z.string() }));

      // WHEN - Create a contract with external resources
      const result = definePublisherFirst(externalExchange, localQueue, sharedMessage, {
        routingKey: "shared.event",
      });

      const contract = defineContract({
        // Only include local resources in exchanges
        exchanges: {},
        queues: {
          localQueue,
        },
        bindings: {
          externalBinding: result.binding,
        },
        publishers: {
          publishToExternal: result.publisher,
        },
        consumers: {
          consumeFromLocal: result.createConsumer(),
        },
      });

      // THEN - Contract should work with external resources
      expect(contract.publishers?.publishToExternal?.exchange).toBe(externalExchange);
      expect(contract.bindings?.externalBinding?.exchange).toBe(externalExchange);
      expect(contract.consumers?.consumeFromLocal?.queue).toBe(localQueue);
    });
  });
});
