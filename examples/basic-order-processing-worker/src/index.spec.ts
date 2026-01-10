import { TypedAmqpWorker, defineUnsafeHandlers } from "@amqp-contract/worker";
import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { orderContract } from "@amqp-contract-examples/basic-order-processing-contract";

describe("Basic Order Processing Worker Integration", () => {
  it("should process new orders from order.created queue", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const worker = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: defineUnsafeHandlers(orderContract, {
        processOrder: async (msg) => {
          processedOrders.push(msg);
        },
        notifyOrder: async () => {},
        shipOrder: async () => {},
        handleUrgentOrder: async () => {},
        processAnalytics: async () => {},
        handleFailedOrders: async () => {},
      }),
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    const newOrder = {
      orderId: "TEST-001",
      customerId: "CUST-123",
      items: [{ productId: "PROD-A", quantity: 2, price: 29.99 }],
      totalAmount: 59.98,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    publishMessage(
      orderContract.publishers.orderCreated.exchange.name,
      orderContract.publishers.orderCreated.routingKey,
      newOrder,
    );

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(processedOrders).toEqual([newOrder]);

    // CLEANUP
    await worker.close().resultToPromise();
  });

  it("should receive notifications for all order events", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const notifications: Array<unknown> = [];
    const worker = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: defineUnsafeHandlers(orderContract, {
        processOrder: async () => {},
        notifyOrder: async (msg) => {
          notifications.push(msg);
        },
        shipOrder: async () => {},
        handleUrgentOrder: async () => {},
        processAnalytics: async () => {},
        handleFailedOrders: async () => {},
      }),
      urls: [amqpConnectionUrl],
    }).resultToPromise();

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

    publishMessage(
      orderContract.publishers.orderCreated.exchange.name,
      orderContract.publishers.orderCreated.routingKey,
      newOrder,
    );
    publishMessage(
      orderContract.publishers.orderUpdated.exchange.name,
      orderContract.publishers.orderUpdated.routingKey,
      orderUpdate,
    );

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    // CLEANUP
    await worker.close().resultToPromise();
  });

  it("should start all consumers with consumeAll", async ({
    amqpConnectionUrl,
    publishMessage,
  }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const notifications: Array<unknown> = [];
    const worker = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: defineUnsafeHandlers(orderContract, {
        processOrder: async (msg) => {
          processedOrders.push(msg);
        },
        notifyOrder: async (msg) => {
          notifications.push(msg);
        },
        shipOrder: async () => {},
        handleUrgentOrder: async () => {},
        processAnalytics: async () => {},
        handleFailedOrders: async () => {},
      }),
      urls: [amqpConnectionUrl],
    }).resultToPromise();

    const newOrder = {
      orderId: "TEST-003",
      customerId: "CUST-789",
      items: [{ productId: "PROD-C", quantity: 1, price: 19.99 }],
      totalAmount: 19.99,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    publishMessage(
      orderContract.publishers.orderCreated.exchange.name,
      orderContract.publishers.orderCreated.routingKey,
      newOrder,
    );

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(processedOrders.length).toBeGreaterThanOrEqual(1);
    expect(notifications.length).toBeGreaterThan(0); // Receives all events

    // CLEANUP
    await worker.close().resultToPromise();
  });
});
