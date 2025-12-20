import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { TypedAmqpClient } from "@amqp-contract/client";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

describe("Basic Order Processing Worker Integration", () => {
  it("should process new orders from order.created queue", async ({ amqpConnection }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const worker = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: {
        processOrder: (msg) => {
          processedOrders.push(msg);
        },
        notifyOrder: async () => {},
        shipOrder: async () => {},
        handleUrgentOrder: async () => {},
      },
      connection: amqpConnection,
    });

    const client = await TypedAmqpClient.create({
      contract: orderContract,
      connection: amqpConnection,
    });

    const newOrder = {
      orderId: "TEST-001",
      customerId: "CUST-123",
      items: [{ productId: "PROD-A", quantity: 2, price: 29.99 }],
      totalAmount: 59.98,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    await client.publish("orderCreated", newOrder);

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(processedOrders).toHaveLength(1);
    expect(processedOrders[0]).toEqual(newOrder);

    // CLEANUP
    await worker.close();
    await client.close();
  });

  it("should receive notifications for all order events", async ({ amqpConnection }) => {
    // GIVEN
    const notifications: Array<unknown> = [];
    const worker = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: {
        processOrder: async () => {},
        notifyOrder: async (msg) => {
          notifications.push(msg);
        },
        shipOrder: async () => {},
        handleUrgentOrder: async () => {},
      },
      connection: amqpConnection,
    });

    const client = await TypedAmqpClient.create({
      contract: orderContract,
      connection: amqpConnection,
    });

    // WHEN
    const newOrder = {
      orderId: "TEST-002",
      customerId: "CUST-456",
      items: [{ productId: "PROD-B", quantity: 1, price: 49.99 }],
      totalAmount: 49.99,
      createdAt: new Date().toISOString(),
    };

    const orderUpdate = {
      orderId: "TEST-002",
      status: "processing" as const,
      updatedAt: new Date().toISOString(),
    };

    await client.publish("orderCreated", newOrder);
    await client.publish("orderUpdated", orderUpdate);

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    // CLEANUP
    await worker.close();
    await client.close();
  });

  it("should start all consumers with consumeAll", async ({ amqpConnection }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const notifications: Array<unknown> = [];
    const worker = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: {
        processOrder: async (msg) => {
          processedOrders.push(msg);
        },
        notifyOrder: async (msg) => {
          notifications.push(msg);
        },
        shipOrder: async () => {},
        handleUrgentOrder: async () => {},
      },
      connection: amqpConnection,
    });

    const client = await TypedAmqpClient.create({
      contract: orderContract,
      connection: amqpConnection,
    });

    const newOrder = {
      orderId: "TEST-003",
      customerId: "CUST-789",
      items: [{ productId: "PROD-C", quantity: 1, price: 19.99 }],
      totalAmount: 19.99,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    await client.publish("orderCreated", newOrder);

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(processedOrders.length).toBeGreaterThanOrEqual(1);
    expect(notifications.length).toBeGreaterThan(0); // Receives all events

    // CLEANUP
    await worker.close();
    await client.close();
  });
});
