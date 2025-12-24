import { describe, expect } from "vitest";
import { it } from "@amqp-contract/testing/extension";
import { TypedAmqpWorker } from "@amqp-contract/worker";
import { TypedAmqpClient } from "@amqp-contract/client";

import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

describe("Basic Order Processing Worker Integration", () => {
  it("should process new orders from order.created queue", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const workerResult = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: {
        processOrder: (msg) => {
          processedOrders.push(msg);
          return Promise.resolve();
        },
        notifyOrder: () => Promise.resolve(),
        shipOrder: () => Promise.resolve(),
        handleUrgentOrder: () => Promise.resolve(),
        processAnalytics: () => Promise.resolve(),
      },
      urls: [amqpConnectionUrl],
    });

    if (workerResult.isError()) {
      throw workerResult.error;
    }
    const worker = workerResult.value;

    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    expect(clientResult.isOk()).toBe(true);
    const client = clientResult.get();

    const newOrder = {
      orderId: "TEST-001",
      customerId: "CUST-123",
      items: [{ productId: "PROD-A", quantity: 2, price: 29.99 }],
      totalAmount: 59.98,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    const result = await client.publish("orderCreated", newOrder);
    expect(result.isOk()).toBe(true);

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(processedOrders).toHaveLength(1);
    expect(processedOrders[0]).toEqual(newOrder);

    // CLEANUP
    await worker.close().resultToPromise();
    await client.close().resultToPromise();
  });

  it("should receive notifications for all order events", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const notifications: Array<unknown> = [];
    const workerResult = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: {
        processOrder: () => Promise.resolve(),
        notifyOrder: (msg) => {
          notifications.push(msg);
          return Promise.resolve();
        },
        shipOrder: () => Promise.resolve(),
        handleUrgentOrder: () => Promise.resolve(),
        processAnalytics: () => Promise.resolve(),
      },
      urls: [amqpConnectionUrl],
    });

    if (workerResult.isError()) {
      throw workerResult.error;
    }
    const worker = workerResult.value;

    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    expect(clientResult.isOk()).toBe(true);
    const client = clientResult.get();

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

    const result1 = await client.publish("orderCreated", newOrder);
    const result2 = await client.publish("orderUpdated", orderUpdate);
    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    // CLEANUP
    await worker.close().resultToPromise();
    await client.close().resultToPromise();
  });

  it("should start all consumers with consumeAll", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const notifications: Array<unknown> = [];
    const workerResult = await TypedAmqpWorker.create({
      contract: orderContract,
      handlers: {
        processOrder: (msg) => {
          processedOrders.push(msg);
          return Promise.resolve();
        },
        notifyOrder: (msg) => {
          notifications.push(msg);
          return Promise.resolve();
        },
        shipOrder: () => Promise.resolve(),
        handleUrgentOrder: () => Promise.resolve(),
        processAnalytics: () => Promise.resolve(),
      },
      urls: [amqpConnectionUrl],
    });

    if (workerResult.isError()) {
      throw workerResult.error;
    }
    const worker = workerResult.value;

    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    expect(clientResult.isOk()).toBe(true);
    const client = clientResult.get();

    const newOrder = {
      orderId: "TEST-003",
      customerId: "CUST-789",
      items: [{ productId: "PROD-C", quantity: 1, price: 19.99 }],
      totalAmount: 19.99,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    const result = await client.publish("orderCreated", newOrder);
    expect(result.isOk()).toBe(true);

    // THEN
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(processedOrders.length).toBeGreaterThanOrEqual(1);
    expect(notifications.length).toBeGreaterThan(0); // Receives all events

    // CLEANUP
    await worker.close().resultToPromise();
    await client.close().resultToPromise();
  });
});
