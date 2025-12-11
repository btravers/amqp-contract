import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineBinding,
  defineConsumer,
  defineContract,
  defineExchange,
  definePublisher,
  defineQueue,
} from "@amqp-contract/contract";
import { generateAsyncAPI } from "./generator.js";

describe("generateAsyncAPI", () => {
  it("should generate a valid AsyncAPI 3.0.0 document", () => {
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
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
            amount: z.number(),
          }),
          {
            routingKey: "order.created",
          },
        ),
      },
      consumers: {
        processOrder: defineConsumer(
          "order-processing",
          z.object({
            orderId: z.string(),
            amount: z.number(),
          }),
        ),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
        description: "Test description",
      },
      servers: {
        dev: {
          host: "localhost:5672",
          protocol: "amqp",
          description: "Development server",
        },
      },
    });

    // Validate structure
    expect(asyncAPI.asyncapi).toBe("3.0.0");
    expect(asyncAPI.info.title).toBe("Test API");
    expect(asyncAPI.info.version).toBe("1.0.0");
    expect(asyncAPI.info.description).toBe("Test description");
    expect(asyncAPI.servers).toBeDefined();
    expect(asyncAPI.servers?.["dev"]?.host).toBe("localhost:5672");
  });

  it("should generate channels from exchanges", () => {
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
        notifications: defineExchange("notifications", "fanout"),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(asyncAPI.channels).toBeDefined();
    expect(asyncAPI.channels?.["orders"]).toBeDefined();
    expect(asyncAPI.channels?.["orders"]?.address).toBe("orders");
    expect(asyncAPI.channels?.["orders"]?.bindings?.amqp?.is).toBe("routingKey");
    expect(asyncAPI.channels?.["orders"]?.bindings?.amqp?.exchange?.type).toBe("topic");
  });

  it("should generate channels from queues", () => {
    const contract = defineContract({
      queues: {
        orderProcessing: defineQueue("order-processing", { durable: true }),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(asyncAPI.channels).toBeDefined();
    expect(asyncAPI.channels?.["orderProcessing"]).toBeDefined();
    expect(asyncAPI.channels?.["orderProcessing"]?.address).toBe("order-processing");
    expect(asyncAPI.channels?.["orderProcessing"]?.bindings?.amqp?.is).toBe("queue");
    expect(asyncAPI.channels?.["orderProcessing"]?.bindings?.amqp?.queue?.name).toBe(
      "order-processing",
    );
  });

  it("should generate operations from publishers", () => {
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic"),
      },
      publishers: {
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
            amount: z.number(),
          }),
        ),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(asyncAPI.operations).toBeDefined();
    expect(asyncAPI.operations?.["orderCreated"]).toBeDefined();
    expect(asyncAPI.operations?.["orderCreated"]?.action).toBe("send");
    expect(asyncAPI.operations?.["orderCreated"]?.channel.$ref).toBe("#/channels/orders");
  });

  it("should generate operations from consumers", () => {
    const contract = defineContract({
      queues: {
        orderProcessing: defineQueue("order-processing"),
      },
      consumers: {
        processOrder: defineConsumer(
          "order-processing",
          z.object({
            orderId: z.string(),
          }),
        ),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(asyncAPI.operations).toBeDefined();
    expect(asyncAPI.operations?.["processOrder"]).toBeDefined();
    expect(asyncAPI.operations?.["processOrder"]?.action).toBe("receive");
    expect(asyncAPI.operations?.["processOrder"]?.channel.$ref).toBe("#/channels/order-processing");
  });

  it("should generate message schemas with proper types", () => {
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic"),
      },
      publishers: {
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
            amount: z.number(),
            items: z.array(
              z.object({
                productId: z.string(),
                quantity: z.number(),
              }),
            ),
            isUrgent: z.boolean(),
          }),
        ),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(asyncAPI.components?.messages).toBeDefined();
    const message = asyncAPI.components?.messages?.["orderCreatedMessage"];
    expect(message).toBeDefined();
    expect(message?.payload).toBeDefined();
    expect(message?.payload?.type).toBe("object");
    expect(message?.payload?.properties).toBeDefined();

    // Check individual field types
    const properties = message?.payload?.properties;
    expect(properties?.["orderId"]?.type).toBe("string");
    expect(properties?.["amount"]?.type).toBe("number");
    expect(properties?.["items"]?.type).toBe("array");
    expect(properties?.["items"]?.items?.type).toBe("object");
    expect(properties?.["isUrgent"]?.type).toBe("boolean");
  });

  it("should handle required fields in schemas", () => {
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic"),
      },
      publishers: {
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
            amount: z.number(),
          }),
        ),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    const message = asyncAPI.components?.messages?.["orderCreatedMessage"];
    expect(message?.payload?.required).toBeDefined();
    expect(message?.payload?.required).toContain("orderId");
    expect(message?.payload?.required).toContain("amount");
  });

  it("should use default values when info fields are not provided", () => {
    const contract = defineContract({});

    const asyncAPI = generateAsyncAPI(contract, {
      info: {},
    });

    expect(asyncAPI.info.title).toBe("AMQP Contract API");
    expect(asyncAPI.info.version).toBe("1.0.0");
  });

  it("should handle contracts without servers", () => {
    const contract = defineContract({});

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    expect(asyncAPI.servers).toBeUndefined();
  });

  it("should validate AsyncAPI document structure", () => {
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
      queues: {
        orderProcessing: defineQueue("order-processing", { durable: true }),
      },
      publishers: {
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
          }),
        ),
      },
      consumers: {
        processOrder: defineConsumer(
          "order-processing",
          z.object({
            orderId: z.string(),
          }),
        ),
      },
    });

    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      servers: {
        production: {
          host: "rabbitmq.example.com:5672",
          protocol: "amqp",
        },
      },
    });

    // Validate required AsyncAPI 3.0.0 fields
    expect(asyncAPI).toHaveProperty("asyncapi");
    expect(asyncAPI).toHaveProperty("info");
    expect(asyncAPI.info).toHaveProperty("title");
    expect(asyncAPI.info).toHaveProperty("version");

    // Validate structure matches AsyncAPI 3.0.0 spec
    expect(asyncAPI.asyncapi).toBe("3.0.0");
    expect(typeof asyncAPI.info.title).toBe("string");
    expect(typeof asyncAPI.info.version).toBe("string");

    // Validate channels structure
    if (asyncAPI.channels) {
      for (const channel of Object.values(asyncAPI.channels)) {
        expect(channel).toHaveProperty("address");
        expect(typeof channel.address).toBe("string");
      }
    }

    // Validate operations structure
    if (asyncAPI.operations) {
      for (const operation of Object.values(asyncAPI.operations)) {
        expect(operation).toHaveProperty("action");
        expect(["send", "receive"]).toContain(operation.action);
        expect(operation).toHaveProperty("channel");
        expect(operation.channel).toHaveProperty("$ref");
      }
    }

    // Validate components structure
    if (asyncAPI.components?.messages) {
      for (const message of Object.values(asyncAPI.components.messages)) {
        expect(message).toHaveProperty("payload");
      }
    }
  });
});
