import {
  defineCommandConsumer,
  defineCommandPublisher,
  defineConsumer,
  defineContract,
  defineEventConsumer,
  defineEventPublisher,
  defineExchange,
  defineExchangeBinding,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
  defineQuorumQueue,
  defineTtlBackoffQueue,
  extractQueue,
  isBridgedPublisherConfig,
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
    it("should create a queue definition with quorum type by default", () => {
      // WHEN
      const queue = defineQueue("test-queue", { durable: true });

      // THEN
      expect(queue).toEqual({
        name: "test-queue",
        type: "quorum",
        durable: true,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
      });
    });

    it("should create a queue with minimal options and quorum type", () => {
      // WHEN
      const queue = defineQueue("test-queue");

      // THEN
      expect(queue).toEqual({
        name: "test-queue",
        type: "quorum",
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
      });
    });

    it("should create a classic queue when explicitly specified", () => {
      // WHEN
      const queue = defineQueue("test-queue", { type: "classic", durable: true });

      // THEN
      expect(queue).toEqual({
        name: "test-queue",
        type: "classic",
        durable: true,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
      });
    });

    it("should create a queue with dead letter exchange", () => {
      // GIVEN
      const dlx = defineExchange("test-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineQueue("test-queue", {
        durable: true,
        deadLetter: {
          exchange: dlx,
          routingKey: "failed",
        },
      });

      // THEN - returns QueueWithTtlBackoffInfrastructure due to default ttl-backoff retry + deadLetter
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "test-queue",
          type: "quorum",
          durable: true,
          deadLetter: {
            exchange: dlx,
            routingKey: "failed",
          },
          retry: {
            mode: "ttl-backoff",
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            jitter: true,
          },
        },
      });
    });

    it("should create a queue with dead letter exchange without routing key", () => {
      // GIVEN
      const dlx = defineExchange("test-dlx", "fanout", { durable: true });

      // WHEN
      const queue = defineQueue("test-queue", {
        durable: true,
        deadLetter: {
          exchange: dlx,
        },
      });

      // THEN - returns QueueWithTtlBackoffInfrastructure due to default ttl-backoff retry + deadLetter
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "test-queue",
          type: "quorum",
          durable: true,
          deadLetter: {
            exchange: dlx,
          },
          retry: {
            mode: "ttl-backoff",
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            jitter: true,
          },
        },
      });
    });

    it("should allow exclusive with classic queue", () => {
      // WHEN
      const queue = defineQueue("test-queue", { type: "classic", exclusive: true });

      // THEN
      expect(queue).toEqual({
        name: "test-queue",
        type: "classic",
        exclusive: true,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
      });
    });
  });

  describe("defineQueue with maxPriority", () => {
    it("should create a priority queue with x-max-priority argument using classic type", () => {
      // WHEN
      const queue = defineQueue("priority-queue", {
        type: "classic",
        durable: true,
        maxPriority: 10,
      });

      // THEN
      expect(queue).toEqual({
        name: "priority-queue",
        type: "classic",
        durable: true,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
        arguments: {
          "x-max-priority": 10,
        },
      });
    });

    it("should create a priority queue with minimal options using classic type", () => {
      // WHEN
      const queue = defineQueue("priority-queue", { type: "classic", maxPriority: 5 });

      // THEN
      expect(queue).toEqual({
        name: "priority-queue",
        type: "classic",
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
        arguments: {
          "x-max-priority": 5,
        },
      });
    });

    it("should merge additional arguments with x-max-priority", () => {
      // WHEN
      const queue = defineQueue("priority-queue", {
        type: "classic",
        durable: true,
        maxPriority: 10,
        arguments: {
          "x-message-ttl": 60000,
        },
      });

      // THEN
      expect(queue).toEqual({
        name: "priority-queue",
        type: "classic",
        durable: true,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
        arguments: {
          "x-message-ttl": 60000,
          "x-max-priority": 10,
        },
      });
    });

    it("should create a priority queue with dead letter exchange", () => {
      // GIVEN
      const dlx = defineExchange("test-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineQueue("priority-queue", {
        type: "classic",
        durable: true,
        maxPriority: 10,
        deadLetter: {
          exchange: dlx,
          routingKey: "failed",
        },
      });

      // THEN - returns QueueWithTtlBackoffInfrastructure due to default ttl-backoff retry + deadLetter
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "priority-queue",
          type: "classic",
          durable: true,
          deadLetter: {
            exchange: dlx,
            routingKey: "failed",
          },
          retry: {
            mode: "ttl-backoff",
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            jitter: true,
          },
          arguments: {
            "x-max-priority": 10,
          },
        },
      });
    });

    it("should throw error for maxPriority less than 1", () => {
      // WHEN/THEN
      expect(() => defineQueue("priority-queue", { type: "classic", maxPriority: 0 })).toThrow(
        "Invalid maxPriority: 0. Must be between 1 and 255. Recommended range: 1-10.",
      );
    });

    it("should throw error for maxPriority greater than 255", () => {
      // WHEN/THEN
      expect(() => defineQueue("priority-queue", { type: "classic", maxPriority: 256 })).toThrow(
        "Invalid maxPriority: 256. Must be between 1 and 255. Recommended range: 1-10.",
      );
    });

    it("should accept maxPriority of 1", () => {
      // WHEN
      const queue = defineQueue("priority-queue", { type: "classic", maxPriority: 1 });

      // THEN
      expect(queue).toEqual({
        name: "priority-queue",
        type: "classic",
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
        arguments: {
          "x-max-priority": 1,
        },
      });
    });

    it("should accept maxPriority of 255", () => {
      // WHEN
      const queue = defineQueue("priority-queue", { type: "classic", maxPriority: 255 });

      // THEN
      expect(queue).toEqual({
        name: "priority-queue",
        type: "classic",
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
        arguments: {
          "x-max-priority": 255,
        },
      });
    });
  });

  describe("defineQueue with deliveryLimit", () => {
    it("should create a quorum queue with delivery limit", () => {
      // WHEN
      const queue = defineQueue("retry-queue", {
        type: "quorum",
        deliveryLimit: 3,
      });

      // THEN
      expect(queue).toEqual({
        name: "retry-queue",
        type: "quorum",
        deliveryLimit: 3,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
      });
    });

    it("should create a default quorum queue with delivery limit", () => {
      // WHEN (type defaults to "quorum")
      const queue = defineQueue("retry-queue", {
        deliveryLimit: 5,
      });

      // THEN
      expect(queue).toEqual({
        name: "retry-queue",
        type: "quorum",
        deliveryLimit: 5,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
      });
    });

    it("should create a quorum queue with delivery limit and dead letter exchange", () => {
      // GIVEN
      const dlx = defineExchange("test-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineQueue("retry-queue", {
        type: "quorum",
        deliveryLimit: 3,
        deadLetter: {
          exchange: dlx,
          routingKey: "failed",
        },
      });

      // THEN - returns QueueWithTtlBackoffInfrastructure due to default ttl-backoff retry + deadLetter
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "retry-queue",
          type: "quorum",
          deliveryLimit: 3,
          deadLetter: {
            exchange: dlx,
            routingKey: "failed",
          },
          retry: {
            mode: "ttl-backoff",
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            jitter: true,
          },
        },
      });
    });

    it("should throw error for deliveryLimit less than 1", () => {
      // WHEN/THEN
      expect(() => defineQueue("retry-queue", { deliveryLimit: 0 })).toThrow(
        "Invalid deliveryLimit: 0. Must be a positive integer.",
      );
    });

    it("should throw error for non-integer deliveryLimit", () => {
      // WHEN/THEN
      expect(() => defineQueue("retry-queue", { deliveryLimit: 2.5 })).toThrow(
        "Invalid deliveryLimit: 2.5. Must be a positive integer.",
      );
    });

    it("should accept deliveryLimit of 1", () => {
      // WHEN
      const queue = defineQueue("retry-queue", { deliveryLimit: 1 });

      // THEN
      expect(queue).toEqual({
        name: "retry-queue",
        type: "quorum",
        deliveryLimit: 1,
        retry: {
          mode: "ttl-backoff",
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          jitter: true,
        },
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
        publishers: {
          orderCreated: definePublisher(ordersExchange, message, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(orderProcessingQueue, message),
        },
      });

      // THEN - exchanges and queues are auto-extracted using resource names as keys
      expect(contract).toMatchObject({
        exchanges: {
          orders: { name: "orders", type: "topic", durable: true },
        },
        queues: {
          "order-processing": { name: "order-processing", durable: true },
        },
        bindings: {},
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

      // THEN - minimal contract now includes empty objects for all properties
      expect(contract).toEqual({
        exchanges: {},
        queues: {},
        bindings: {},
        publishers: {},
        consumers: {},
      });
    });

    it("should create a contract with multiple exchanges and queues", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const sourceExchange = defineExchange("source-exchange", "topic", { durable: true });
      const finalQueue = defineQueue("final-queue", { durable: true });

      // WHEN - exchanges and queues are auto-extracted from publishers/consumers
      const contract = defineContract({
        publishers: {
          orderCreated: definePublisher(sourceExchange, message, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(finalQueue, message),
        },
      });

      // THEN - exchanges and queues use resource names as keys
      expect(contract).toMatchObject({
        exchanges: {
          "source-exchange": { name: "source-exchange" },
        },
        queues: {
          "final-queue": { name: "final-queue" },
        },
        bindings: {},
      });
    });
  });

  describe("defineEventPublisher and defineEventConsumer", () => {
    it("should create an event publisher with fanout exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("test-exchange", "fanout");
      const queue = defineQueue("test-queue");

      // WHEN
      const eventPublisher = defineEventPublisher(exchange, message);
      const { consumer, binding } = defineEventConsumer(eventPublisher, queue);

      // THEN
      expect(eventPublisher).toMatchObject({
        __brand: "EventPublisherConfig",
        exchange,
        message,
        routingKey: undefined,
      });
      expect(binding).toEqual({
        type: "queue",
        queue,
        exchange,
      });
      expect(consumer).toEqual({
        queue,
        message,
      });
    });

    it("should create an event publisher with topic exchange", () => {
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
      const eventPublisher = defineEventPublisher(exchange, message, {
        routingKey: "order.created",
      });
      const { consumer, binding } = defineEventConsumer(eventPublisher, queue);

      // THEN
      expect(eventPublisher).toMatchObject({
        __brand: "EventPublisherConfig",
        exchange,
        message,
        routingKey: "order.created",
      });
      expect(binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "order.created",
      });
      expect(consumer).toEqual({
        queue,
        message,
      });
    });

    it("should create an event publisher with direct exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ taskId: z.string() }));
      const exchange = defineExchange("tasks", "direct");
      const queue = defineQueue("task-queue");

      // WHEN
      const eventPublisher = defineEventPublisher(exchange, message, {
        routingKey: "task.execute",
      });
      const { consumer, binding } = defineEventConsumer(eventPublisher, queue);

      // THEN
      expect(eventPublisher).toMatchObject({
        __brand: "EventPublisherConfig",
        routingKey: "task.execute",
      });
      expect(binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "task.execute",
      });
      expect(consumer).toEqual({
        queue,
        message,
      });
    });

    it("should allow consumer to override routing key for topic exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ orderId: z.string() }));
      const exchange = defineExchange("orders", "topic", { durable: true });
      const queue1 = defineQueue("order-processing", { durable: true });
      const queue2 = defineQueue("all-orders", { durable: true });

      // WHEN
      const eventPublisher = defineEventPublisher(exchange, message, {
        routingKey: "order.created",
      });
      const { binding: binding1 } = defineEventConsumer(eventPublisher, queue1);
      const { binding: binding2 } = defineEventConsumer(eventPublisher, queue2, {
        routingKey: "order.*",
      });

      // THEN
      expect(binding1).toMatchObject({
        routingKey: "order.created", // Uses publisher's key
      });
      expect(binding2).toMatchObject({
        routingKey: "order.*", // Overridden with pattern
      });
    });

    it("should extract EventPublisherConfig from publishers section", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const orderQueue = defineQueue("order-processing", { durable: true });

      // WHEN - EventPublisherConfig goes directly in publishers
      const orderCreated = defineEventPublisher(ordersExchange, message, {
        routingKey: "order.created",
      });

      const contract = defineContract({
        publishers: {
          // EventPublisherConfig auto-extracted to publisher
          orderCreated,
        },
        consumers: {
          // EventConsumerResult auto-extracted to consumer + binding
          processOrder: defineEventConsumer(orderCreated, orderQueue),
        },
      });

      // THEN - EventPublisherConfig is converted to publisher, resources use name as key
      expect(contract).toMatchObject({
        exchanges: {
          orders: { name: "orders", type: "topic", durable: true },
        },
        queues: {
          "order-processing": { name: "order-processing", durable: true },
        },
        bindings: {
          processOrderBinding: {
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

    it("should auto-extract binding when passing EventConsumerResult directly to consumers", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const orderQueue = defineQueue("order-processing", { durable: true });
      const notificationQueue = defineQueue("notifications", { durable: true });

      // WHEN - No manual destructuring needed!
      const orderCreated = defineEventPublisher(ordersExchange, message, {
        routingKey: "order.created",
      });

      const contract = defineContract({
        publishers: {
          orderCreated,
        },
        // Pass EventConsumerResult directly - bindings are auto-extracted
        consumers: {
          processOrder: defineEventConsumer(orderCreated, orderQueue),
          sendNotification: defineEventConsumer(orderCreated, notificationQueue),
        },
      });

      // THEN - bindings are auto-generated from EventConsumerResult
      expect(contract).toMatchObject({
        bindings: {
          // Auto-generated bindings with naming convention: {consumerName}Binding
          processOrderBinding: {
            type: "queue",
            queue: orderQueue,
            exchange: ordersExchange,
            routingKey: "order.created",
          },
          sendNotificationBinding: {
            type: "queue",
            queue: notificationQueue,
            exchange: ordersExchange,
            routingKey: "order.created",
          },
        },
        consumers: {
          processOrder: {
            queue: orderQueue,
            message,
          },
          sendNotification: {
            queue: notificationQueue,
            message,
          },
        },
      });
    });

    it("should support mixing plain ConsumerDefinition and EventConsumerResult in consumers", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const exchange = defineExchange("events", "fanout");
      const queue1 = defineQueue("queue-1");
      const queue2 = defineQueue("queue-2");

      const eventPublisher = defineEventPublisher(exchange, message);

      // WHEN - Mix of plain consumer and EventConsumerResult
      const contract = defineContract({
        consumers: {
          // Plain ConsumerDefinition
          plainConsumer: defineConsumer(queue1, message),
          // EventConsumerResult - binding auto-extracted
          eventConsumer: defineEventConsumer(eventPublisher, queue2),
        },
      });

      // THEN
      expect(contract.consumers).toMatchObject({
        plainConsumer: { queue: queue1, message },
        eventConsumer: { queue: queue2, message },
      });

      // Only the EventConsumerResult generates a binding
      expect(contract.bindings).toMatchObject({
        eventConsumerBinding: {
          type: "queue",
          queue: queue2,
          exchange,
        },
      });
      // Plain consumers don't auto-generate bindings
      expect(Object.keys(contract.bindings ?? {})).not.toContain("plainConsumerBinding");
    });
  });

  describe("defineCommandConsumer and defineCommandPublisher", () => {
    it("should create a command consumer with fanout exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");
      const exchange = defineExchange("test-exchange", "fanout");

      // WHEN
      const command = defineCommandConsumer(queue, exchange, message);
      const publisher = defineCommandPublisher(command);

      // THEN
      expect(command).toMatchObject({
        __brand: "CommandConsumerConfig",
        consumer: { queue, message },
        binding: { type: "queue", queue, exchange },
        exchange,
        message,
        routingKey: undefined,
      });
      expect(publisher).toEqual({
        exchange,
        message,
      });
    });

    it("should create a command consumer with direct exchange", () => {
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
      const command = defineCommandConsumer(queue, exchange, message, {
        routingKey: "task.execute",
      });
      const publisher = defineCommandPublisher(command);

      // THEN
      expect(command.consumer).toEqual({
        queue,
        message,
      });
      expect(command.binding).toEqual({
        type: "queue",
        queue,
        exchange,
        routingKey: "task.execute",
      });
      expect(publisher).toEqual({
        exchange,
        message,
        routingKey: "task.execute",
      });
    });

    it("should create a command consumer with topic exchange", () => {
      // GIVEN
      const message = defineMessage(z.object({ eventId: z.string() }));
      const queue = defineQueue("event-queue");
      const exchange = defineExchange("events", "topic");

      // WHEN
      const command = defineCommandConsumer(queue, exchange, message, {
        routingKey: "event.*",
      });
      const publisher = defineCommandPublisher(command, {
        routingKey: "event.processed",
      });

      // THEN
      expect(command.binding).toMatchObject({
        routingKey: "event.*",
      });
      expect(publisher).toMatchObject({
        routingKey: "event.processed",
      });
    });

    it("should extract CommandConsumerConfig from consumers section", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          userId: z.string(),
          action: z.string(),
        }),
      );
      const auditQueue = defineQueue("audit-log", { durable: true });
      const auditExchange = defineExchange("audit", "topic", { durable: true });

      // WHEN - CommandConsumerConfig goes directly in consumers
      const processAudit = defineCommandConsumer(auditQueue, auditExchange, message, {
        routingKey: "audit.log",
      });
      const logAuditPublisher = defineCommandPublisher(processAudit);

      const contract = defineContract({
        publishers: {
          logAudit: logAuditPublisher,
        },
        consumers: {
          // CommandConsumerConfig auto-extracted to consumer + binding
          processAudit,
        },
      });

      // THEN - CommandConsumerConfig is converted to consumer and binding, resources use name as key
      expect(contract).toMatchObject({
        exchanges: {
          audit: { name: "audit", type: "topic", durable: true },
        },
        queues: {
          "audit-log": { name: "audit-log", durable: true },
        },
        bindings: {
          processAuditBinding: {
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

    it("should allow multiple publishers for topic exchange command", () => {
      // GIVEN
      const message = defineMessage(
        z.object({
          orderId: z.string(),
          amount: z.number(),
        }),
      );
      const queue = defineQueue("order-processing", { durable: true });
      const exchange = defineExchange("orders", "topic", { durable: true });

      // WHEN - Consumer bound with pattern, publishers use concrete keys
      const processOrder = defineCommandConsumer(queue, exchange, message, {
        routingKey: "order.*",
      });
      const publisherCreated = defineCommandPublisher(processOrder, {
        routingKey: "order.created",
      });
      const publisherUpdated = defineCommandPublisher(processOrder, {
        routingKey: "order.updated",
      });

      // THEN
      expect(processOrder.binding).toMatchObject({
        routingKey: "order.*",
      });
      expect(publisherCreated).toEqual({
        exchange,
        message,
        routingKey: "order.created",
      });
      expect(publisherUpdated).toEqual({
        exchange,
        message,
        routingKey: "order.updated",
      });
    });
  });

  describe("event and command patterns with external resources", () => {
    it("should support using external exchange with event pattern", () => {
      // GIVEN - External exchange from another contract
      const externalExchange = defineExchange("external-events", "topic", { durable: true });
      const localQueue = defineQueue("local-queue", { durable: true });
      const message = defineMessage(z.object({ eventId: z.string() }));

      // WHEN - Use external exchange with local queue
      const eventPublisher = defineEventPublisher(externalExchange, message, {
        routingKey: "external.event",
      });
      const { consumer, binding } = defineEventConsumer(eventPublisher, localQueue);

      // THEN
      expect(eventPublisher).toMatchObject({
        exchange: externalExchange,
        message,
      });
      expect(binding).toMatchObject({
        exchange: externalExchange,
      });
      expect(consumer.queue).toBe(localQueue);
    });

    it("should support using external queue with command pattern", () => {
      // GIVEN - External queue from another contract
      const externalQueue = defineQueue("external-queue", { durable: true });
      const localExchange = defineExchange("local-exchange", "direct", { durable: true });
      const message = defineMessage(z.object({ data: z.string() }));

      // WHEN - Use external queue with local exchange
      const command = defineCommandConsumer(externalQueue, localExchange, message, {
        routingKey: "local.route",
      });
      const publisher = defineCommandPublisher(command);

      // THEN
      expect(command.consumer.queue).toBe(externalQueue);
      expect(command.binding.queue).toBe(externalQueue);
      expect(publisher).toMatchObject({ exchange: localExchange });
    });

    it("should support mixed EventPublisherConfig and CommandConsumerConfig in a contract", () => {
      // GIVEN
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const notificationsExchange = defineExchange("notifications", "fanout", { durable: true });
      const orderQueue = defineQueue("order-queue", { durable: true });
      const notificationQueue = defineQueue("notification-queue", { durable: true });

      const orderMessage = defineMessage(z.object({ orderId: z.string() }));
      const notificationMessage = defineMessage(z.object({ message: z.string() }));

      // WHEN - All configs go directly in publishers and consumers
      const orderCreated = defineEventPublisher(ordersExchange, orderMessage, {
        routingKey: "order.created",
      });

      const sendNotification = defineCommandConsumer(
        notificationQueue,
        notificationsExchange,
        notificationMessage,
      );

      const contract = defineContract({
        publishers: {
          // EventPublisherConfig auto-extracted to publisher
          orderCreated,
        },
        consumers: {
          // EventConsumerResult auto-extracted to consumer + binding
          processOrder: defineEventConsumer(orderCreated, orderQueue),
          // CommandConsumerConfig auto-extracted to consumer + binding
          sendNotification,
        },
      });

      // THEN - All configs are expanded and bindings auto-generated
      expect(contract).toMatchObject({
        publishers: {
          orderCreated: expect.objectContaining({
            exchange: ordersExchange,
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: expect.objectContaining({
            queue: orderQueue,
          }),
          sendNotification: expect.objectContaining({
            queue: notificationQueue,
          }),
        },
        bindings: {
          processOrderBinding: expect.objectContaining({
            type: "queue",
          }),
          sendNotificationBinding: expect.objectContaining({
            type: "queue",
          }),
        },
      });
    });

    it("should auto-generate TTL-backoff retry infrastructure from consumer queue", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const orderMessage = defineMessage(z.object({ orderId: z.string() }));
      const orderQueue = defineQueue("order-processing", {
        deadLetter: { exchange: dlx },
        retry: { mode: "ttl-backoff", maxRetries: 5, initialDelayMs: 2000 },
      });

      const orderCreated = defineEventPublisher(ordersExchange, orderMessage, {
        routingKey: "order.created",
      });

      // WHEN
      const contract = defineContract({
        publishers: { orderCreated },
        consumers: {
          processOrder: defineEventConsumer(orderCreated, extractQueue(orderQueue)),
        },
      });

      // THEN - DLX exchange is auto-extracted
      expect(contract.exchanges).toMatchObject({
        orders: ordersExchange,
        "orders-dlx": dlx,
      });

      // Wait queue is auto-generated
      expect(contract.queues).toMatchObject({
        "order-processing": extractQueue(orderQueue),
        "order-processing-wait": expect.objectContaining({
          name: "order-processing-wait",
          type: "quorum",
          deadLetter: {
            exchange: dlx,
            routingKey: "order-processing",
          },
        }),
      });

      // Wait binding (DLX → wait queue) and retry binding (DLX → main queue)
      expect(contract.bindings).toMatchObject({
        processOrderBinding: expect.objectContaining({
          type: "queue",
          queue: extractQueue(orderQueue),
          exchange: ordersExchange,
          routingKey: "order.created",
        }),
        "order-processingWaitBinding": expect.objectContaining({
          type: "queue",
          queue: expect.objectContaining({ name: "order-processing-wait" }),
          exchange: dlx,
          routingKey: "order-processing-wait",
        }),
        "order-processingRetryBinding": expect.objectContaining({
          type: "queue",
          queue: extractQueue(orderQueue),
          exchange: dlx,
          routingKey: "order-processing",
        }),
      });
    });
  });

  describe("defineQuorumQueue", () => {
    it("should create a quorum queue with quorum-native retry", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineQuorumQueue("order-processing", {
        deadLetter: { exchange: dlx },
        deliveryLimit: 3,
      });

      // THEN
      expect(queue).toEqual({
        name: "order-processing",
        type: "quorum",
        deadLetter: { exchange: dlx },
        deliveryLimit: 3,
        retry: { mode: "quorum-native" },
      });
    });

    it("should create a quorum queue with dead letter routing key", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineQuorumQueue("order-processing", {
        deadLetter: { exchange: dlx, routingKey: "failed.orders" },
        deliveryLimit: 5,
      });

      // THEN
      expect(queue).toEqual({
        name: "order-processing",
        type: "quorum",
        deadLetter: { exchange: dlx, routingKey: "failed.orders" },
        deliveryLimit: 5,
        retry: { mode: "quorum-native" },
      });
    });

    it("should create a quorum queue with autoDelete option", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineQuorumQueue("order-processing", {
        deadLetter: { exchange: dlx },
        deliveryLimit: 3,
        autoDelete: true,
      });

      // THEN
      expect(queue).toEqual({
        name: "order-processing",
        type: "quorum",
        deadLetter: { exchange: dlx },
        deliveryLimit: 3,
        autoDelete: true,
        retry: { mode: "quorum-native" },
      });
    });

    it("should create a quorum queue with additional arguments", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineQuorumQueue("order-processing", {
        deadLetter: { exchange: dlx },
        deliveryLimit: 3,
        arguments: { "x-message-ttl": 86400000 },
      });

      // THEN
      expect(queue).toEqual({
        name: "order-processing",
        type: "quorum",
        deadLetter: { exchange: dlx },
        deliveryLimit: 3,
        retry: { mode: "quorum-native" },
        arguments: { "x-message-ttl": 86400000 },
      });
    });

    it("should create a quorum queue with all options combined", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineQuorumQueue("order-processing", {
        deadLetter: { exchange: dlx, routingKey: "failed" },
        deliveryLimit: 10,
        autoDelete: false,
        arguments: { "x-message-ttl": 3600000 },
      });

      // THEN
      expect(queue).toEqual({
        name: "order-processing",
        type: "quorum",
        deadLetter: { exchange: dlx, routingKey: "failed" },
        deliveryLimit: 10,
        autoDelete: false,
        retry: { mode: "quorum-native" },
        arguments: { "x-message-ttl": 3600000 },
      });
    });
  });

  describe("defineTtlBackoffQueue", () => {
    it("should create a TTL-backoff queue with default retry options", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx },
      });

      // THEN - returns QueueWithTtlBackoffInfrastructure
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "order-processing",
          type: "quorum",
          deadLetter: { exchange: dlx },
          retry: {
            mode: "ttl-backoff",
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            jitter: true,
          },
        },
        waitQueue: {
          name: "order-processing-wait",
          type: "quorum",
        },
      });
    });

    it("should create a TTL-backoff queue with custom retry options", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx },
        maxRetries: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 3,
        jitter: false,
      });

      // THEN
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "order-processing",
          type: "quorum",
          deadLetter: { exchange: dlx },
          retry: {
            mode: "ttl-backoff",
            maxRetries: 5,
            initialDelayMs: 2000,
            maxDelayMs: 60000,
            backoffMultiplier: 3,
            jitter: false,
          },
        },
      });
    });

    it("should create a TTL-backoff queue with dead letter routing key", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx, routingKey: "failed.orders" },
      });

      // THEN
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          deadLetter: { exchange: dlx, routingKey: "failed.orders" },
        },
      });
    });

    it("should create a TTL-backoff queue with autoDelete option", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx },
        autoDelete: true,
      });

      // THEN
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          autoDelete: true,
        },
      });
    });

    it("should create a TTL-backoff queue with additional arguments", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx },
        arguments: { "x-message-ttl": 86400000 },
      });

      // THEN
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          arguments: { "x-message-ttl": 86400000 },
        },
      });
    });

    it("should allow extractQueue to access underlying queue definition", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx },
        maxRetries: 5,
      });

      // WHEN
      const queueDef = extractQueue(queue);

      // THEN
      expect(queueDef.name).toBe("order-processing");
      expect(queueDef.type).toBe("quorum");
      expect(queueDef.deadLetter).toEqual({ exchange: dlx });
    });

    it("should include wait queue bindings in infrastructure", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "direct", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx },
      });

      // THEN - verify bindings are created
      expect(queue.waitQueueBinding).toMatchObject({
        type: "queue",
        queue: queue.waitQueue,
        exchange: dlx,
        routingKey: "order-processing-wait",
      });
      expect(queue.mainQueueRetryBinding).toMatchObject({
        type: "queue",
        queue: queue.queue,
        exchange: dlx,
        routingKey: "order-processing",
      });
    });

    it("should create a TTL-backoff queue with all options combined", () => {
      // GIVEN
      const dlx = defineExchange("orders-dlx", "topic", { durable: true });

      // WHEN
      const queue = defineTtlBackoffQueue("order-processing", {
        deadLetter: { exchange: dlx, routingKey: "failed" },
        maxRetries: 10,
        initialDelayMs: 500,
        maxDelayMs: 120000,
        backoffMultiplier: 1.5,
        jitter: true,
        autoDelete: false,
        arguments: { "x-message-ttl": 3600000 },
      });

      // THEN
      expect(queue).toMatchObject({
        __brand: "QueueWithTtlBackoffInfrastructure",
        queue: {
          name: "order-processing",
          type: "quorum",
          deadLetter: { exchange: dlx, routingKey: "failed" },
          autoDelete: false,
          retry: {
            mode: "ttl-backoff",
            maxRetries: 10,
            initialDelayMs: 500,
            maxDelayMs: 120000,
            backoffMultiplier: 1.5,
            jitter: true,
          },
          arguments: { "x-message-ttl": 3600000 },
        },
        waitQueue: {
          name: "order-processing-wait",
          type: "quorum",
        },
      });
    });
  });

  describe("bridgeExchange support", () => {
    it("should create a bridged event consumer with topic exchange", () => {
      // GIVEN - Two domains: orders (source) and billing (local)
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const billingExchange = defineExchange("billing", "topic", { durable: true });
      const message = defineMessage(z.object({ orderId: z.string() }));
      const billingQueue = defineQueue("billing-order-processing");

      // WHEN - Subscribe to orders events via bridge
      const orderCreated = defineEventPublisher(ordersExchange, message, {
        routingKey: "order.created",
      });
      const result = defineEventConsumer(orderCreated, billingQueue, {
        bridgeExchange: billingExchange,
      });

      // THEN - Queue binds to bridge, e2e binding from source → bridge
      expect(result.__brand).toBe("EventConsumerResult");
      expect(result.exchange).toBe(ordersExchange); // source exchange preserved
      expect(result.bridgeExchange).toBe(billingExchange);
      expect(result.binding).toMatchObject({
        type: "queue",
        queue: billingQueue,
        exchange: billingExchange, // queue binds to bridge
        routingKey: "order.created",
      });
      expect(result.exchangeBinding).toEqual({
        type: "exchange",
        source: ordersExchange,
        destination: billingExchange,
        routingKey: "order.created",
      });
    });

    it("should create a bridged event consumer with fanout exchange", () => {
      // GIVEN
      const logsExchange = defineExchange("logs", "fanout");
      const analyticsExchange = defineExchange("analytics", "fanout");
      const message = defineMessage(z.object({ level: z.string() }));
      const analyticsQueue = defineQueue("analytics-logs");

      // WHEN
      const logEvent = defineEventPublisher(logsExchange, message);
      const result = defineEventConsumer(logEvent, analyticsQueue, {
        bridgeExchange: analyticsExchange,
      });

      // THEN
      expect(result.bridgeExchange).toBe(analyticsExchange);
      expect(result.binding).toMatchObject({
        type: "queue",
        queue: analyticsQueue,
        exchange: analyticsExchange,
      });
      expect(result.exchangeBinding).toEqual({
        type: "exchange",
        source: logsExchange,
        destination: analyticsExchange,
      });
    });

    it("should create a bridged command publisher with topic exchange", () => {
      // GIVEN - Remote domain owns the command consumer
      const remoteExchange = defineExchange("remote-commands", "topic", { durable: true });
      const localExchange = defineExchange("local-commands", "topic", { durable: true });
      const message = defineMessage(z.object({ taskId: z.string() }));
      const remoteQueue = defineQueue("remote-task-queue");

      // WHEN - Create command consumer on remote, publish via bridge
      const command = defineCommandConsumer(remoteQueue, remoteExchange, message, {
        routingKey: "task.execute",
      });
      const publisher = defineCommandPublisher(command, {
        bridgeExchange: localExchange,
      });

      // THEN - Publisher is bridged
      expect(isBridgedPublisherConfig(publisher)).toBe(true);
      expect(publisher).toMatchObject({
        __brand: "BridgedPublisherConfig",
        bridgeExchange: localExchange,
        targetExchange: remoteExchange,
      });
      expect(publisher.publisher).toMatchObject({
        exchange: localExchange,
        message,
        routingKey: "task.execute",
      });
      expect(publisher.exchangeBinding).toEqual({
        type: "exchange",
        source: localExchange,
        destination: remoteExchange,
        routingKey: "task.execute",
      });
    });

    it("should extract bridged event consumer into contract", () => {
      // GIVEN
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const billingExchange = defineExchange("billing", "topic", { durable: true });
      const message = defineMessage(z.object({ orderId: z.string() }));
      const billingQueue = defineQueue("billing-orders");

      const orderCreated = defineEventPublisher(ordersExchange, message, {
        routingKey: "order.created",
      });

      // WHEN
      const contract = defineContract({
        consumers: {
          processOrder: defineEventConsumer(orderCreated, billingQueue, {
            bridgeExchange: billingExchange,
          }),
        },
      });

      // THEN - All resources extracted
      expect(contract.exchanges).toMatchObject({
        orders: ordersExchange,
        billing: billingExchange,
      });
      expect(contract.queues).toMatchObject({
        "billing-orders": billingQueue,
      });
      expect(contract.bindings).toMatchObject({
        processOrderBinding: {
          type: "queue",
          queue: billingQueue,
          exchange: billingExchange,
          routingKey: "order.created",
        },
        processOrderExchangeBinding: {
          type: "exchange",
          source: ordersExchange,
          destination: billingExchange,
          routingKey: "order.created",
        },
      });
      expect(contract.consumers).toMatchObject({
        processOrder: {
          queue: billingQueue,
          message,
        },
      });
    });

    it("should extract bridged command publisher into contract", () => {
      // GIVEN
      const remoteExchange = defineExchange("remote", "topic", { durable: true });
      const localExchange = defineExchange("local", "topic", { durable: true });
      const message = defineMessage(z.object({ id: z.string() }));
      const remoteQueue = defineQueue("remote-queue");

      const command = defineCommandConsumer(remoteQueue, remoteExchange, message, {
        routingKey: "cmd.run",
      });

      // WHEN
      const contract = defineContract({
        publishers: {
          runCommand: defineCommandPublisher(command, {
            bridgeExchange: localExchange,
          }),
        },
      });

      // THEN - All resources extracted
      expect(contract.exchanges).toMatchObject({
        local: localExchange,
        remote: remoteExchange,
      });
      expect(contract.bindings).toMatchObject({
        runCommandExchangeBinding: {
          type: "exchange",
          source: localExchange,
          destination: remoteExchange,
          routingKey: "cmd.run",
        },
      });
      expect(contract.publishers).toMatchObject({
        runCommand: {
          exchange: localExchange,
          message,
          routingKey: "cmd.run",
        },
      });
    });

    it("should mix bridged and non-bridged entries in contract", () => {
      // GIVEN
      const ordersExchange = defineExchange("orders", "topic", { durable: true });
      const billingExchange = defineExchange("billing", "topic", { durable: true });
      const localExchange = defineExchange("local", "topic", { durable: true });
      const orderMessage = defineMessage(z.object({ orderId: z.string() }));
      const localMessage = defineMessage(z.object({ id: z.string() }));
      const billingQueue = defineQueue("billing-orders");
      const localQueue = defineQueue("local-processing");

      const orderCreated = defineEventPublisher(ordersExchange, orderMessage, {
        routingKey: "order.created",
      });
      const localEvent = defineEventPublisher(localExchange, localMessage, {
        routingKey: "local.event",
      });

      // WHEN - Mix bridged and non-bridged
      const contract = defineContract({
        publishers: {
          orderCreated,
          localEvent,
        },
        consumers: {
          // Bridged: subscribe to remote orders via billing exchange
          processBillingOrder: defineEventConsumer(orderCreated, billingQueue, {
            bridgeExchange: billingExchange,
          }),
          // Non-bridged: direct local consumer
          processLocal: defineEventConsumer(localEvent, localQueue),
        },
      });

      // THEN - Both types extracted correctly
      expect(contract.exchanges).toMatchObject({
        orders: ordersExchange,
        billing: billingExchange,
        local: localExchange,
      });
      expect(contract.bindings).toMatchObject({
        processBillingOrderBinding: {
          type: "queue",
          exchange: billingExchange,
        },
        processBillingOrderExchangeBinding: {
          type: "exchange",
          source: ordersExchange,
          destination: billingExchange,
        },
        processLocalBinding: {
          type: "queue",
          exchange: localExchange,
        },
      });
      // Non-bridged consumer should NOT have exchange binding
      expect(contract.bindings).not.toHaveProperty("processLocalExchangeBinding");
    });

    it("should not produce bridge fields when bridgeExchange is not provided", () => {
      // GIVEN
      const exchange = defineExchange("test", "topic");
      const message = defineMessage(z.object({ id: z.string() }));
      const queue = defineQueue("test-queue");

      const event = defineEventPublisher(exchange, message, { routingKey: "test.event" });

      // WHEN - No bridgeExchange
      const result = defineEventConsumer(event, queue);

      // THEN - No bridge fields
      expect(result.exchangeBinding).toBeUndefined();
      expect(result.bridgeExchange).toBeUndefined();
    });
  });
});
