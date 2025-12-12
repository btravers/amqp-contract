import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineConsumer,
  defineContract,
  defineExchange,
  definePublisher,
  defineQueue,
} from "@amqp-contract/contract";
import { generateAsyncAPI } from "./generator.js";

describe("generateAsyncAPI", () => {
  it("should generate AsyncAPI 3.0.0 version", () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      asyncapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      channels: {
        orders: {
          address: "orders",
          bindings: {
            amqp: {
              is: "routingKey",
              exchange: {
                type: "topic",
                durable: true,
              },
            },
          },
        },
      },
    });
  });

  it("should include info title from options", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      asyncapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });
  });

  it("should include info version from options", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      asyncapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });
  });

  it("should include info description from options", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
        description: "Test description",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      asyncapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
        description: "Test description",
      },
    });
  });

  it("should include servers from options", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      servers: {
        dev: {
          host: "localhost:5672",
          protocol: "amqp",
          description: "Development server",
        },
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      asyncapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      servers: {
        dev: {
          host: "localhost:5672",
          protocol: "amqp",
          description: "Development server",
        },
      },
    });
  });

  it("should generate channel for exchange", () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      channels: {
        orders: {
          address: "orders",
        },
      },
    });
  });

  it("should generate channel with AMQP exchange binding", () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic", { durable: true }),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      channels: {
        orders: {
          bindings: {
            amqp: {
              is: "routingKey",
              exchange: {
                type: "topic",
                durable: true,
              },
            },
          },
        },
      },
    });
  });

  it("should generate channel for queue", () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orderProcessing: defineQueue("order-processing", { durable: true }),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      channels: {
        orderProcessing: {
          address: "order-processing",
        },
      },
    });
  });

  it("should generate channel with AMQP queue binding", () => {
    // GIVEN
    const contract = defineContract({
      queues: {
        orderProcessing: defineQueue("order-processing", { durable: true }),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      channels: {
        orderProcessing: {
          bindings: {
            amqp: {
              is: "queue",
              queue: {
                name: "order-processing",
                durable: true,
              },
            },
          },
        },
      },
    });
  });

  it("should generate send operation for publisher", () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic"),
      },
      publishers: {
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
          }),
        ),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      operations: {
        orderCreated: {
          action: "send",
        },
      },
    });
  });

  it("should generate operation with channel reference for publisher", () => {
    // GIVEN
    const contract = defineContract({
      exchanges: {
        orders: defineExchange("orders", "topic"),
      },
      publishers: {
        orderCreated: definePublisher(
          "orders",
          z.object({
            orderId: z.string(),
          }),
        ),
      },
    });

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      operations: {
        orderCreated: {
          channel: {
            $ref: "#/channels/orders",
          },
        },
      },
    });
  });

  it("should generate receive operation for consumer", () => {
    // GIVEN
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

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      operations: {
        processOrder: {
          action: "receive",
        },
      },
    });
  });

  it("should generate operation with channel reference for consumer", () => {
    // GIVEN
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

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      operations: {
        processOrder: {
          channel: {
            $ref: "#/channels/order-processing",
          },
        },
      },
    });
  });

  it("should use default title when not provided", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {},
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      info: {
        title: "AMQP Contract API",
        version: "1.0.0",
      },
    });
  });

  it("should use default version when not provided", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {},
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      info: {
        title: "AMQP Contract API",
        version: "1.0.0",
      },
    });
  });

  it("should not include servers when not provided", () => {
    // GIVEN
    const contract = defineContract({});

    // WHEN
    const asyncAPI = generateAsyncAPI(contract, {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });

    // THEN
    expect(asyncAPI).toMatchObject({
      asyncapi: "3.0.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
    });
    expect(asyncAPI.servers).toBeUndefined();
  });
});
