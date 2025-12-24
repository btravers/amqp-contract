import * as v from "valibot";
import {
  type MessageDefinition,
  defineConsumer,
  defineContract,
  defineExchange,
  defineMessage,
  definePublisher,
  defineQueue,
  defineQueueBinding,
} from "@amqp-contract/contract";
import { describe, expect, it } from "vitest";
import { AsyncAPIGenerator } from "./index.js";
import { Parser } from "@asyncapi/parser";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { experimental_ArkTypeToJsonSchemaConverter } from "@orpc/arktype";
import { experimental_ValibotToJsonSchemaConverter } from "@orpc/valibot";
import { type } from "arktype";
import { z } from "zod";

describe("AsyncAPIGenerator", () => {
  describe("with Zod schemas", () => {
    it("should generate valid AsyncAPI 3.0 document with Zod schemas", async () => {
      // GIVEN
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
          processOrder: defineConsumer(orderQueue, orderMessage),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      });

      // WHEN
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

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "orderProcessing": {
              "address": "order-processing",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": true,
                    "exclusive": false,
                    "name": "order-processing",
                  },
                },
              },
              "description": "AMQP Queue: order-processing",
              "messages": {
                "processOrderMessage": {
                  "contentType": "application/json",
                  "description": "Event published when a new order is created",
                  "payload": {
                    "properties": {
                      "amount": {
                        "exclusiveMinimum": 0,
                        "type": "number",
                      },
                      "createdAt": {
                        "format": "date-time",
                        "type": "string",
                      },
                      "customerId": {
                        "type": "string",
                      },
                      "orderId": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "orderId",
                      "customerId",
                      "amount",
                      "createdAt",
                    ],
                    "type": "object",
                  },
                  "summary": "Order created event",
                },
              },
              "title": "order-processing",
            },
            "orders": {
              "address": "orders",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": true,
                    "name": "orders",
                    "type": "topic",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: orders (topic)",
              "messages": {
                "orderCreatedMessage": {
                  "contentType": "application/json",
                  "description": "Event published when a new order is created",
                  "payload": {
                    "properties": {
                      "amount": {
                        "exclusiveMinimum": 0,
                        "type": "number",
                      },
                      "createdAt": {
                        "format": "date-time",
                        "type": "string",
                      },
                      "customerId": {
                        "type": "string",
                      },
                      "orderId": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "orderId",
                      "customerId",
                      "amount",
                      "createdAt",
                    ],
                    "type": "object",
                  },
                  "summary": "Order created event",
                },
              },
              "title": "orders",
            },
          },
          "components": {
            "messages": {
              "orderCreatedMessage": {
                "contentType": "application/json",
                "description": "Event published when a new order is created",
                "payload": {
                  "properties": {
                    "amount": {
                      "exclusiveMinimum": 0,
                      "type": "number",
                    },
                    "createdAt": {
                      "format": "date-time",
                      "type": "string",
                    },
                    "customerId": {
                      "type": "string",
                    },
                    "orderId": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "orderId",
                    "customerId",
                    "amount",
                    "createdAt",
                  ],
                  "type": "object",
                },
                "summary": "Order created event",
              },
              "processOrderMessage": {
                "contentType": "application/json",
                "description": "Event published when a new order is created",
                "payload": {
                  "properties": {
                    "amount": {
                      "exclusiveMinimum": 0,
                      "type": "number",
                    },
                    "createdAt": {
                      "format": "date-time",
                      "type": "string",
                    },
                    "customerId": {
                      "type": "string",
                    },
                    "orderId": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "orderId",
                    "customerId",
                    "amount",
                    "createdAt",
                  ],
                  "type": "object",
                },
                "summary": "Order created event",
              },
            },
          },
          "info": {
            "description": "Order processing messaging API",
            "title": "Order Processing API",
            "version": "1.0.0",
          },
          "operations": {
            "orderCreated": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/orders",
              },
              "description": "Routing key: order.created",
              "messages": [
                {
                  "$ref": "#/channels/orders/messages/orderCreatedMessage",
                },
              ],
              "summary": "Publish to orders",
            },
            "processOrder": {
              "action": "receive",
              "channel": {
                "$ref": "#/channels/orderProcessing",
              },
              "messages": [
                {
                  "$ref": "#/channels/orderProcessing/messages/processOrderMessage",
                },
              ],
              "summary": "Consume from order-processing",
            },
          },
          "servers": {
            "development": {
              "description": "Development RabbitMQ server",
              "host": "localhost:5672",
              "protocol": "amqp",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });

    it("should handle message with headers", async () => {
      // GIVEN
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

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Events API", version: "1.0.0" },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "eventQueue": {
              "address": "event-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": false,
                    "exclusive": false,
                    "name": "event-queue",
                  },
                },
              },
              "description": "AMQP Queue: event-queue",
              "title": "event-queue",
            },
            "events": {
              "address": "events",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": false,
                    "name": "events",
                    "type": "fanout",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: events (fanout)",
              "messages": {
                "sendEventMessage": {
                  "contentType": "application/json",
                  "headers": {
                    "properties": {
                      "correlationId": {
                        "type": "string",
                      },
                      "timestamp": {
                        "type": "number",
                      },
                    },
                    "required": [
                      "correlationId",
                      "timestamp",
                    ],
                    "type": "object",
                  },
                  "payload": {
                    "properties": {
                      "data": {
                        "type": "string",
                      },
                      "eventId": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "eventId",
                      "data",
                    ],
                    "type": "object",
                  },
                  "summary": "Event with headers",
                },
              },
              "title": "events",
            },
          },
          "components": {
            "messages": {
              "sendEventMessage": {
                "contentType": "application/json",
                "headers": {
                  "properties": {
                    "correlationId": {
                      "type": "string",
                    },
                    "timestamp": {
                      "type": "number",
                    },
                  },
                  "required": [
                    "correlationId",
                    "timestamp",
                  ],
                  "type": "object",
                },
                "payload": {
                  "properties": {
                    "data": {
                      "type": "string",
                    },
                    "eventId": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "eventId",
                    "data",
                  ],
                  "type": "object",
                },
                "summary": "Event with headers",
              },
            },
          },
          "info": {
            "title": "Events API",
            "version": "1.0.0",
          },
          "operations": {
            "sendEvent": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/events",
              },
              "messages": [
                {
                  "$ref": "#/channels/events/messages/sendEventMessage",
                },
              ],
              "summary": "Publish to events",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });

  describe("with Valibot schemas", () => {
    it("should generate valid AsyncAPI 3.0 document with Valibot schemas", async () => {
      // GIVEN
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

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new experimental_ValibotToJsonSchemaConverter()],
      });

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Notification API",
          version: "1.0.0",
        },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "notificationQueue": {
              "address": "notification-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": true,
                    "exclusive": false,
                    "name": "notification-queue",
                  },
                },
              },
              "description": "AMQP Queue: notification-queue",
              "messages": {
                "processNotificationMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "properties": {
                      "message": {
                        "type": "string",
                      },
                      "notificationId": {
                        "type": "string",
                      },
                      "type": {
                        "enum": [
                          "email",
                          "sms",
                          "push",
                        ],
                      },
                      "userId": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "notificationId",
                      "userId",
                      "message",
                      "type",
                    ],
                    "type": "object",
                  },
                  "summary": "Notification event",
                },
              },
              "title": "notification-queue",
            },
            "notifications": {
              "address": "notifications",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": true,
                    "name": "notifications",
                    "type": "direct",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: notifications (direct)",
              "messages": {
                "sendNotificationMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "properties": {
                      "message": {
                        "type": "string",
                      },
                      "notificationId": {
                        "type": "string",
                      },
                      "type": {
                        "enum": [
                          "email",
                          "sms",
                          "push",
                        ],
                      },
                      "userId": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "notificationId",
                      "userId",
                      "message",
                      "type",
                    ],
                    "type": "object",
                  },
                  "summary": "Notification event",
                },
              },
              "title": "notifications",
            },
          },
          "components": {
            "messages": {
              "processNotificationMessage": {
                "contentType": "application/json",
                "payload": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                    "notificationId": {
                      "type": "string",
                    },
                    "type": {
                      "enum": [
                        "email",
                        "sms",
                        "push",
                      ],
                    },
                    "userId": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "notificationId",
                    "userId",
                    "message",
                    "type",
                  ],
                  "type": "object",
                },
                "summary": "Notification event",
              },
              "sendNotificationMessage": {
                "contentType": "application/json",
                "payload": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "properties": {
                    "message": {
                      "type": "string",
                    },
                    "notificationId": {
                      "type": "string",
                    },
                    "type": {
                      "enum": [
                        "email",
                        "sms",
                        "push",
                      ],
                    },
                    "userId": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "notificationId",
                    "userId",
                    "message",
                    "type",
                  ],
                  "type": "object",
                },
                "summary": "Notification event",
              },
            },
          },
          "info": {
            "title": "Notification API",
            "version": "1.0.0",
          },
          "operations": {
            "processNotification": {
              "action": "receive",
              "channel": {
                "$ref": "#/channels/notificationQueue",
              },
              "messages": [
                {
                  "$ref": "#/channels/notificationQueue/messages/processNotificationMessage",
                },
              ],
              "summary": "Consume from notification-queue",
            },
            "sendNotification": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/notifications",
              },
              "description": "Routing key: notification.send",
              "messages": [
                {
                  "$ref": "#/channels/notifications/messages/sendNotificationMessage",
                },
              ],
              "summary": "Publish to notifications",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });

  describe("with ArkType schemas", () => {
    it("should generate valid AsyncAPI 3.0 document with ArkType schemas", async () => {
      // GIVEN
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
          processPayment: defineConsumer(paymentQueue, paymentMessage),
        },
      });

      const generator = new AsyncAPIGenerator({
        schemaConverters: [new experimental_ArkTypeToJsonSchemaConverter()],
      });

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Payment API",
          version: "1.0.0",
        },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "paymentProcessing": {
              "address": "payment-processing",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": false,
                    "exclusive": false,
                    "name": "payment-processing",
                  },
                },
              },
              "description": "AMQP Queue: payment-processing",
              "messages": {
                "processPaymentMessage": {
                  "contentType": "application/json",
                  "description": "Event for payment processing",
                  "payload": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "properties": {
                      "amount": {
                        "type": "number",
                      },
                      "currency": {
                        "enum": [
                          "EUR",
                          "GBP",
                          "USD",
                        ],
                      },
                      "orderId": {
                        "type": "string",
                      },
                      "paymentId": {
                        "type": "string",
                      },
                      "status": {
                        "enum": [
                          "completed",
                          "failed",
                          "pending",
                        ],
                      },
                    },
                    "required": [
                      "amount",
                      "currency",
                      "orderId",
                      "paymentId",
                      "status",
                    ],
                    "type": "object",
                  },
                  "summary": "Payment event",
                },
              },
              "title": "payment-processing",
            },
            "payments": {
              "address": "payments",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": false,
                    "name": "payments",
                    "type": "topic",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: payments (topic)",
              "messages": {
                "paymentCreatedMessage": {
                  "contentType": "application/json",
                  "description": "Event for payment processing",
                  "payload": {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "properties": {
                      "amount": {
                        "type": "number",
                      },
                      "currency": {
                        "enum": [
                          "EUR",
                          "GBP",
                          "USD",
                        ],
                      },
                      "orderId": {
                        "type": "string",
                      },
                      "paymentId": {
                        "type": "string",
                      },
                      "status": {
                        "enum": [
                          "completed",
                          "failed",
                          "pending",
                        ],
                      },
                    },
                    "required": [
                      "amount",
                      "currency",
                      "orderId",
                      "paymentId",
                      "status",
                    ],
                    "type": "object",
                  },
                  "summary": "Payment event",
                },
              },
              "title": "payments",
            },
          },
          "components": {
            "messages": {
              "paymentCreatedMessage": {
                "contentType": "application/json",
                "description": "Event for payment processing",
                "payload": {
                  "$schema": "https://json-schema.org/draft/2020-12/schema",
                  "properties": {
                    "amount": {
                      "type": "number",
                    },
                    "currency": {
                      "enum": [
                        "EUR",
                        "GBP",
                        "USD",
                      ],
                    },
                    "orderId": {
                      "type": "string",
                    },
                    "paymentId": {
                      "type": "string",
                    },
                    "status": {
                      "enum": [
                        "completed",
                        "failed",
                        "pending",
                      ],
                    },
                  },
                  "required": [
                    "amount",
                    "currency",
                    "orderId",
                    "paymentId",
                    "status",
                  ],
                  "type": "object",
                },
                "summary": "Payment event",
              },
              "processPaymentMessage": {
                "contentType": "application/json",
                "description": "Event for payment processing",
                "payload": {
                  "$schema": "https://json-schema.org/draft/2020-12/schema",
                  "properties": {
                    "amount": {
                      "type": "number",
                    },
                    "currency": {
                      "enum": [
                        "EUR",
                        "GBP",
                        "USD",
                      ],
                    },
                    "orderId": {
                      "type": "string",
                    },
                    "paymentId": {
                      "type": "string",
                    },
                    "status": {
                      "enum": [
                        "completed",
                        "failed",
                        "pending",
                      ],
                    },
                  },
                  "required": [
                    "amount",
                    "currency",
                    "orderId",
                    "paymentId",
                    "status",
                  ],
                  "type": "object",
                },
                "summary": "Payment event",
              },
            },
          },
          "info": {
            "title": "Payment API",
            "version": "1.0.0",
          },
          "operations": {
            "paymentCreated": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/payments",
              },
              "description": "Routing key: payment.created",
              "messages": [
                {
                  "$ref": "#/channels/payments/messages/paymentCreatedMessage",
                },
              ],
              "summary": "Publish to payments",
            },
            "processPayment": {
              "action": "receive",
              "channel": {
                "$ref": "#/channels/paymentProcessing",
              },
              "messages": [
                {
                  "$ref": "#/channels/paymentProcessing/messages/processPaymentMessage",
                },
              ],
              "summary": "Consume from payment-processing",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });

  describe("with multiple schema libraries", () => {
    it("should handle contract with mixed schema types", async () => {
      // GIVEN
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

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Mixed Schema API",
          version: "1.0.0",
        },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "mixed": {
              "address": "mixed",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": false,
                    "name": "mixed",
                    "type": "topic",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: mixed (topic)",
              "messages": {
                "publishValibotMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "properties": {
                      "data": {
                        "type": "string",
                      },
                      "id": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "id",
                      "data",
                    ],
                    "type": "object",
                  },
                },
                "publishZodMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "properties": {
                      "id": {
                        "type": "string",
                      },
                      "value": {
                        "type": "number",
                      },
                    },
                    "required": [
                      "id",
                      "value",
                    ],
                    "type": "object",
                  },
                },
              },
              "title": "mixed",
            },
            "valibotQueue": {
              "address": "valibot-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": false,
                    "exclusive": false,
                    "name": "valibot-queue",
                  },
                },
              },
              "description": "AMQP Queue: valibot-queue",
              "title": "valibot-queue",
            },
            "zodQueue": {
              "address": "zod-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": false,
                    "exclusive": false,
                    "name": "zod-queue",
                  },
                },
              },
              "description": "AMQP Queue: zod-queue",
              "title": "zod-queue",
            },
          },
          "components": {
            "messages": {
              "publishValibotMessage": {
                "contentType": "application/json",
                "payload": {
                  "$schema": "http://json-schema.org/draft-07/schema#",
                  "properties": {
                    "data": {
                      "type": "string",
                    },
                    "id": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "id",
                    "data",
                  ],
                  "type": "object",
                },
              },
              "publishZodMessage": {
                "contentType": "application/json",
                "payload": {
                  "properties": {
                    "id": {
                      "type": "string",
                    },
                    "value": {
                      "type": "number",
                    },
                  },
                  "required": [
                    "id",
                    "value",
                  ],
                  "type": "object",
                },
              },
            },
          },
          "info": {
            "title": "Mixed Schema API",
            "version": "1.0.0",
          },
          "operations": {
            "publishValibot": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/mixed",
              },
              "description": "Routing key: valibot.event",
              "messages": [
                {
                  "$ref": "#/channels/mixed/messages/publishValibotMessage",
                },
              ],
              "summary": "Publish to mixed",
            },
            "publishZod": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/mixed",
              },
              "description": "Routing key: zod.event",
              "messages": [
                {
                  "$ref": "#/channels/mixed/messages/publishZodMessage",
                },
              ],
              "summary": "Publish to mixed",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });

  describe("without schema converters", () => {
    it("should generate document with generic object schemas", async () => {
      // GIVEN
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

      const generator = new AsyncAPIGenerator();

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: {
          title: "Generic API",
          version: "1.0.0",
        },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "generic": {
              "address": "generic",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": false,
                    "name": "generic",
                    "type": "fanout",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: generic (fanout)",
              "messages": {
                "publishMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "type": "object",
                  },
                },
              },
              "title": "generic",
            },
            "genericQueue": {
              "address": "generic-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": false,
                    "exclusive": false,
                    "name": "generic-queue",
                  },
                },
              },
              "description": "AMQP Queue: generic-queue",
              "title": "generic-queue",
            },
          },
          "components": {
            "messages": {
              "publishMessage": {
                "contentType": "application/json",
                "payload": {
                  "type": "object",
                },
              },
            },
          },
          "info": {
            "title": "Generic API",
            "version": "1.0.0",
          },
          "operations": {
            "publish": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/generic",
              },
              "messages": [
                {
                  "$ref": "#/channels/generic/messages/publishMessage",
                },
              ],
              "summary": "Publish to generic",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });

  describe("channel and operation generation", () => {
    it("should generate correct AMQP bindings for queues", async () => {
      // GIVEN
      const queue = defineQueue("test-queue", {
        durable: true,
        exclusive: false,
        autoDelete: false,
      });

      const contract = defineContract({
        queues: { testQueue: queue },
      });

      const generator = new AsyncAPIGenerator();

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "testQueue": {
              "address": "test-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": true,
                    "exclusive": false,
                    "name": "test-queue",
                  },
                },
              },
              "description": "AMQP Queue: test-queue",
              "title": "test-queue",
            },
          },
          "components": {
            "messages": {},
          },
          "info": {
            "title": "Test",
            "version": "1.0.0",
          },
          "operations": {},
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });

    it("should generate correct AMQP bindings for exchanges", async () => {
      // GIVEN
      const exchange = defineExchange("test-exchange", "topic", {
        durable: true,
        autoDelete: false,
      });

      const contract = defineContract({
        exchanges: { testExchange: exchange },
      });

      const generator = new AsyncAPIGenerator();

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "testExchange": {
              "address": "test-exchange",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": true,
                    "name": "test-exchange",
                    "type": "topic",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: test-exchange (topic)",
              "title": "test-exchange",
            },
          },
          "components": {
            "messages": {},
          },
          "info": {
            "title": "Test",
            "version": "1.0.0",
          },
          "operations": {},
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });

    it("should include routing keys in operation descriptions", async () => {
      // GIVEN
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

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Test", version: "1.0.0" },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "orders": {
              "address": "orders",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": false,
                    "name": "orders",
                    "type": "topic",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: orders (topic)",
              "messages": {
                "orderCreatedMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "properties": {
                      "id": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "id",
                    ],
                    "type": "object",
                  },
                },
              },
              "title": "orders",
            },
          },
          "components": {
            "messages": {
              "orderCreatedMessage": {
                "contentType": "application/json",
                "payload": {
                  "properties": {
                    "id": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "id",
                  ],
                  "type": "object",
                },
              },
            },
          },
          "info": {
            "title": "Test",
            "version": "1.0.0",
          },
          "operations": {
            "orderCreated": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/orders",
              },
              "description": "Routing key: order.created",
              "messages": [
                {
                  "$ref": "#/channels/orders/messages/orderCreatedMessage",
                },
              ],
              "summary": "Publish to orders",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty contract", async () => {
      // GIVEN
      const contract = defineContract({});

      const generator = new AsyncAPIGenerator();

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Empty", version: "1.0.0" },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {},
          "components": {
            "messages": {},
          },
          "info": {
            "title": "Empty",
            "version": "1.0.0",
          },
          "operations": {},
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });

    it("should handle fanout exchanges without routing keys", async () => {
      // GIVEN
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

      // WHEN
      const asyncapiDoc = await generator.generate(contract, {
        info: { title: "Fanout Test", version: "1.0.0" },
      });

      // THEN
      expect(asyncapiDoc).toMatchInlineSnapshot(`
        {
          "asyncapi": "3.0.0",
          "channels": {
            "fanout": {
              "address": "fanout-exchange",
              "bindings": {
                "amqp": {
                  "exchange": {
                    "autoDelete": false,
                    "durable": false,
                    "name": "fanout-exchange",
                    "type": "fanout",
                  },
                  "is": "routingKey",
                },
              },
              "description": "AMQP Exchange: fanout-exchange (fanout)",
              "messages": {
                "broadcastMessage": {
                  "contentType": "application/json",
                  "payload": {
                    "properties": {
                      "id": {
                        "type": "string",
                      },
                    },
                    "required": [
                      "id",
                    ],
                    "type": "object",
                  },
                },
              },
              "title": "fanout-exchange",
            },
            "fanoutQueue": {
              "address": "fanout-queue",
              "bindings": {
                "amqp": {
                  "is": "queue",
                  "queue": {
                    "autoDelete": false,
                    "durable": false,
                    "exclusive": false,
                    "name": "fanout-queue",
                  },
                },
              },
              "description": "AMQP Queue: fanout-queue",
              "title": "fanout-queue",
            },
          },
          "components": {
            "messages": {
              "broadcastMessage": {
                "contentType": "application/json",
                "payload": {
                  "properties": {
                    "id": {
                      "type": "string",
                    },
                  },
                  "required": [
                    "id",
                  ],
                  "type": "object",
                },
              },
            },
          },
          "info": {
            "title": "Fanout Test",
            "version": "1.0.0",
          },
          "operations": {
            "broadcast": {
              "action": "send",
              "channel": {
                "$ref": "#/channels/fanout",
              },
              "messages": [
                {
                  "$ref": "#/channels/fanout/messages/broadcastMessage",
                },
              ],
              "summary": "Publish to fanout-exchange",
            },
          },
        }
      `);

      const parser = new Parser();
      await expect(parser.parse(JSON.stringify(asyncapiDoc))).resolves.toEqual(
        expect.objectContaining({ diagnostics: [] }),
      );
    });
  });
});
