import { describe, expect, it } from "vitest";
import { AsyncAPIGenerator } from "./index.js";
import {
  defineContract,
  defineExchange,
  defineQueue,
  defineQueueBinding,
  definePublisher,
  defineConsumer,
  defineMessage,
  type MessageDefinition,
} from "@amqp-contract/contract";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { experimental_ValibotToJsonSchemaConverter } from "@orpc/valibot";
import { experimental_ArkTypeToJsonSchemaConverter } from "@orpc/arktype";
import { z } from "zod";
import * as v from "valibot";
import { type } from "arktype";
import { Parser } from "@asyncapi/parser";
import type {
  MessageObject,
  ChannelObject,
  OperationObject,
} from "@asyncapi/parser/esm/spec-types/v3";

describe("AsyncAPIGenerator", () => {
  describe("with Zod schemas", () => {
    it("should generate valid AsyncAPI 3.0 document with Zod schemas", async () => {
      // Define contract with Zod
      const orderExchange = defineExchange("orders", "topic", { durable: true });
      const orderQueue = defineQueue("order-processing", { durable: true });

      const orderSchema = z.object({
        orderId: z.string(),
        customerId: z.string(),
        amount: z.number().positive(),
        createdAt: z.string().datetime(),
      });

      const orderMessage = defineMessage(orderSchema, {
        summary: "Order created event",
        description: "Event published when a new order is created",
      });

      const contract = defineContract({
        exchanges: {
          orders: orderExchange,
        },
        queues: {
          orderProcessing: orderQueue,
        },
        bindings: {
          orderBinding: defineQueueBinding(orderQueue, orderExchange, {
            routingKey: "order.created",
          }),
        },
        publishers: {
          orderCreated: definePublisher(orderExchange, orderMessage, {
            routingKey: "order.created",
          }),
        },
        consumers: {
          processOrder: defineConsumer(orderQueue, orderMessage, {
            prefetch: 10,
          }),
        },
      });

      // Generate AsyncAPI
      const generator = new AsyncAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Order Processing API",
          version: "1.0.0",
          description: "Order processing messaging API",
        },
        servers: {
          development: {
            host: "localhost:5672",
            protocol: "amqp",
            description: "Development RabbitMQ server",
          },
        },
      });

      // Verify structure
      expect(asyncapiDoc.asyncapi).toBe("3.0.0");
      expect(asyncapiDoc.info.title).toBe("Order Processing API");
      expect(asyncapiDoc.channels).toBeDefined();
      expect(asyncapiDoc.operations).toBeDefined();
      expect(asyncapiDoc.components?.messages).toBeDefined();

      // Verify channels
      expect(asyncapiDoc.channels?.["orders"]).toMatchObject({
        address: "orders",
        title: "orders",
      });
      expect(asyncapiDoc.channels?.["orderProcessing"]).toMatchObject({
        address: "order-processing",
        title: "order-processing",
      });

      // Verify operations
      expect(asyncapiDoc.operations?.["orderCreated"]).toMatchObject({
        action: "send",
      });
      expect(asyncapiDoc.operations?.["processOrder"]).toMatchObject({
        action: "receive",
      });

      // Verify messages
      expect(asyncapiDoc.components?.messages?.["orderCreatedMessage"]).toBeDefined();
      expect(asyncapiDoc.components?.messages?.["processOrderMessage"]).toBeDefined();

      // Verify message schema structure
      const orderCreatedMsg = asyncapiDoc.components?.messages?.[
        "orderCreatedMessage"
      ] as MessageObject;
      expect(orderCreatedMsg?.payload).toMatchObject({
        type: "object",
        properties: {
          orderId: { type: "string" },
          customerId: { type: "string" },
          amount: { type: "number" },
          createdAt: { type: "string" },
        },
        required: ["orderId", "customerId", "amount", "createdAt"],
      });

      // Validate with AsyncAPI parser
      const parser = new Parser();
      const { document, diagnostics } = await parser.parse(JSON.stringify(asyncapiDoc));

      expect(diagnostics).toHaveLength(0);
      expect(document).toBeDefined();
    });

    it("should handle message with headers", async () => {
      const exchange = defineExchange("events", "fanout");
      const queue = defineQueue("event-queue");

      const payloadSchema = z.object({
        eventId: z.string(),
        data: z.string(),
      });

      const headersSchema = z.object({
        correlationId: z.string(),
        timestamp: z.number(),
      });

      const message = defineMessage(payloadSchema, {
        headers: headersSchema,
        summary: "Event with headers",
      });

      const contract = defineContract({
        exchanges: { events: exchange },
        queues: { eventQueue: queue },
        publishers: {
          sendEvent: definePublisher(exchange, message as unknown as MessageDefinition),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Events API", version: "1.0.0" },
      });

      const eventMessage = asyncapiDoc.components?.messages?.["sendEventMessage"] as MessageObject;
      expect(eventMessage?.headers).toBeDefined();
      expect(eventMessage?.headers).toMatchObject({
        type: "object",
        properties: {
          correlationId: { type: "string" },
          timestamp: { type: "number" },
        },
      });
    });
  });

  describe("with Valibot schemas", () => {
    it("should generate valid AsyncAPI 3.0 document with Valibot schemas", async () => {
      // Define contract with Valibot
      const notificationExchange = defineExchange("notifications", "direct", { durable: true });
      const notificationQueue = defineQueue("notification-queue", { durable: true });

      const notificationSchema = v.object({
        notificationId: v.string(),
        userId: v.string(),
        message: v.string(),
        type: v.picklist(["email", "sms", "push"]),
      });

      const notificationMessage = defineMessage(notificationSchema, {
        summary: "Notification event",
      });

      const contract = defineContract({
        exchanges: {
          notifications: notificationExchange,
        },
        queues: {
          notificationQueue: notificationQueue,
        },
        publishers: {
          sendNotification: definePublisher(notificationExchange, notificationMessage, {
            routingKey: "notification.send",
          }),
        },
        consumers: {
          processNotification: defineConsumer(notificationQueue, notificationMessage),
        },
      });

      // Generate AsyncAPI
      const generator = new AsyncAPIGenerator({
        schemaConverters: [new experimental_ValibotToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Notification API",
          version: "1.0.0",
        },
      });

      // Verify structure
      expect(asyncapiDoc.asyncapi).toBe("3.0.0");
      expect(asyncapiDoc.channels?.["notifications"]).toBeDefined();
      expect(asyncapiDoc.operations?.["sendNotification"]).toBeDefined();

      // Verify message schema
      const notificationMsg = asyncapiDoc.components?.messages?.[
        "sendNotificationMessage"
      ] as MessageObject;
      expect(notificationMsg?.payload).toMatchObject({
        type: "object",
        properties: expect.objectContaining({
          notificationId: expect.any(Object),
          userId: expect.any(Object),
          message: expect.any(Object),
          type: expect.any(Object),
        }),
      });

      // Validate with AsyncAPI parser
      const parser = new Parser();
      const { diagnostics } = await parser.parse(JSON.stringify(asyncapiDoc));

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("with ArkType schemas", () => {
    it("should generate valid AsyncAPI 3.0 document with ArkType schemas", async () => {
      // Define contract with ArkType
      const paymentExchange = defineExchange("payments", "topic");
      const paymentQueue = defineQueue("payment-processing");

      const paymentSchema = type({
        paymentId: "string",
        orderId: "string",
        amount: "number",
        currency: "'USD' | 'EUR' | 'GBP'",
        status: "'pending' | 'completed' | 'failed'",
      });

      const paymentMessage = defineMessage(paymentSchema, {
        summary: "Payment event",
        description: "Event for payment processing",
      });

      const contract = defineContract({
        exchanges: {
          payments: paymentExchange,
        },
        queues: {
          paymentProcessing: paymentQueue,
        },
        publishers: {
          paymentCreated: definePublisher(paymentExchange, paymentMessage, {
            routingKey: "payment.created",
          }),
        },
        consumers: {
          processPayment: defineConsumer(paymentQueue, paymentMessage, {
            prefetch: 5,
          }),
        },
      });

      // Generate AsyncAPI
      const generator = new AsyncAPIGenerator({
        schemaConverters: [new experimental_ArkTypeToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Payment API",
          version: "1.0.0",
        },
      });

      // Verify structure
      expect(asyncapiDoc.asyncapi).toBe("3.0.0");
      expect(asyncapiDoc.channels?.["payments"]).toBeDefined();
      expect(asyncapiDoc.operations?.["paymentCreated"]).toBeDefined();

      // Verify message schema
      const paymentMsg = asyncapiDoc.components?.messages?.[
        "paymentCreatedMessage"
      ] as MessageObject;
      expect(paymentMsg?.payload).toMatchObject({
        type: "object",
        properties: expect.objectContaining({
          paymentId: expect.any(Object),
          orderId: expect.any(Object),
          amount: expect.any(Object),
        }),
      });

      // Validate with AsyncAPI parser
      const parser = new Parser();
      const { diagnostics } = await parser.parse(JSON.stringify(asyncapiDoc));

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("with multiple schema libraries", () => {
    it("should handle contract with mixed schema types", async () => {
      const exchange = defineExchange("mixed", "topic");
      const queue1 = defineQueue("zod-queue");
      const queue2 = defineQueue("valibot-queue");

      const zodSchema = z.object({
        id: z.string(),
        value: z.number(),
      });

      const valibotSchema = v.object({
        id: v.string(),
        data: v.string(),
      });

      const zodMessage = defineMessage(zodSchema);
      const valibotMessage = defineMessage(valibotSchema);

      const contract = defineContract({
        exchanges: { mixed: exchange },
        queues: {
          zodQueue: queue1,
          valibotQueue: queue2,
        },
        publishers: {
          publishZod: definePublisher(exchange, zodMessage, {
            routingKey: "zod.event",
          }),
          publishValibot: definePublisher(exchange, valibotMessage, {
            routingKey: "valibot.event",
          }),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [
          new ZodToJsonSchemaConverter(),
          new experimental_ValibotToJsonSchemaConverter(),
        ],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Mixed Schema API",
          version: "1.0.0",
        },
      });

      // Verify both messages are converted
      expect(asyncapiDoc.components?.messages?.["publishZodMessage"]).toBeDefined();
      expect(asyncapiDoc.components?.messages?.["publishValibotMessage"]).toBeDefined();

      // Validate with AsyncAPI parser
      const parser = new Parser();
      const { diagnostics } = await parser.parse(JSON.stringify(asyncapiDoc));

      expect(diagnostics).toHaveLength(0);
    });
  });

  describe("without schema converters", () => {
    it("should generate document with generic object schemas", async () => {
      const exchange = defineExchange("generic", "fanout");
      const queue = defineQueue("generic-queue");

      const schema = z.object({
        id: z.string(),
      });

      const message = defineMessage(schema);

      const contract = defineContract({
        exchanges: { generic: exchange },
        queues: { genericQueue: queue },
        publishers: {
          publish: definePublisher(exchange, message),
        },
      });

      // No schema converters
      const generator = new AsyncAPIGenerator();

      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Generic API",
          version: "1.0.0",
        },
      });

      // Should still generate but with generic object schema
      const publishMessage = asyncapiDoc.components?.messages?.["publishMessage"] as MessageObject;
      expect(publishMessage?.payload).toEqual({
        type: "object",
      });
    });
  });

  describe("channel and operation generation", () => {
    it("should generate correct AMQP bindings for queues", async () => {
      const queue = defineQueue("test-queue", {
        durable: true,
        exclusive: false,
        autoDelete: false,
      });

      const contract = defineContract({
        queues: { testQueue: queue },
      });

      const generator = new AsyncAPIGenerator();
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      const testQueue = asyncapiDoc.channels?.["testQueue"] as ChannelObject;
      expect((testQueue?.bindings as unknown as Record<string, unknown>)?.["amqp"]).toMatchObject({
        is: "queue",
        queue: {
          name: "test-queue",
          durable: true,
          exclusive: false,
          autoDelete: false,
        },
      });
    });

    it("should generate correct AMQP bindings for exchanges", async () => {
      const exchange = defineExchange("test-exchange", "topic", {
        durable: true,
        autoDelete: false,
      });

      const contract = defineContract({
        exchanges: { testExchange: exchange },
      });

      const generator = new AsyncAPIGenerator();
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      const testExchange = asyncapiDoc.channels?.["testExchange"] as ChannelObject;
      expect(
        (testExchange?.bindings as unknown as Record<string, unknown>)?.["amqp"],
      ).toMatchObject({
        is: "routingKey",
        exchange: {
          name: "test-exchange",
          type: "topic",
          durable: true,
          autoDelete: false,
        },
      });
    });

    it("should include routing keys in operation descriptions", async () => {
      const exchange = defineExchange("orders", "topic");
      const schema = z.object({ id: z.string() });
      const message = defineMessage(schema);

      const contract = defineContract({
        exchanges: { orders: exchange },
        publishers: {
          orderCreated: definePublisher(exchange, message, {
            routingKey: "order.created",
          }),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      expect((asyncapiDoc.operations?.["orderCreated"] as OperationObject)?.description).toContain(
        "order.created",
      );
    });

    it("should include prefetch in consumer operation descriptions", async () => {
      const queue = defineQueue("orders");
      const schema = z.object({ id: z.string() });
      const message = defineMessage(schema);

      const contract = defineContract({
        queues: { orders: queue },
        consumers: {
          processOrder: defineConsumer(queue, message, {
            prefetch: 20,
          }),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      expect((asyncapiDoc.operations?.["processOrder"] as OperationObject)?.description).toContain(
        "20",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty contract", async () => {
      const contract = defineContract({});

      const generator = new AsyncAPIGenerator();
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Empty", version: "1.0.0" },
      });

      expect(asyncapiDoc.channels).toEqual({});
      expect(asyncapiDoc.operations).toEqual({});
      expect(asyncapiDoc.components?.messages).toEqual({});
    });

    it("should handle fanout exchanges without routing keys", async () => {
      const exchange = defineExchange("fanout-exchange", "fanout");
      const queue = defineQueue("fanout-queue");
      const schema = z.object({ id: z.string() });
      const message = defineMessage(schema);

      const contract = defineContract({
        exchanges: { fanout: exchange },
        queues: { fanoutQueue: queue },
        publishers: {
          broadcast: definePublisher(exchange, message),
        },
        bindings: {
          binding: defineQueueBinding(queue, exchange),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Fanout Test", version: "1.0.0" },
      });

      // Should not have routing key in description
      expect(
        (asyncapiDoc.operations?.["broadcast"] as OperationObject)?.description,
      ).toBeUndefined();
    });
  });
});
