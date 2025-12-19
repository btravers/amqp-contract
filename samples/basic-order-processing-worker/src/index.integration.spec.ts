import { describe, expect, it, afterEach } from "vitest";
import { getAmqpConnection } from "@amqp-contract/testing/extension";
import { createWorker } from "@amqp-contract/worker";
import { createClient } from "@amqp-contract/client";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import type { ChannelModel } from "amqplib";

describe("Basic Order Processing Worker Integration", () => {
  let amqpConnection: ChannelModel;

  afterEach(async () => {
    if (amqpConnection) {
      try {
        await amqpConnection.close();
      } catch {
        // Connection may already be closed
      }
    }
  });

  it("should process new orders from order.created queue", async () => {
    // GIVEN
    amqpConnection = await getAmqpConnection();

    const processedOrders: Array<unknown> = [];
    const worker = createWorker(orderContract, {
      processOrder: (msg) => {
        processedOrders.push(msg);
      },
      notifyOrder: async () => {},
      shipOrder: async () => {},
      handleUrgentOrder: async () => {},
    });

    await worker.connect(amqpConnection);
    await worker.consume("processOrder");

    const clientConnection = await getAmqpConnection();
    const client = createClient(orderContract);
    await client.connect(clientConnection);

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
    try {
      await clientConnection.close();
    } catch {
      // Connection may already be closed
    }
  });

  it("should receive notifications for all order events", async () => {
    // GIVEN
    amqpConnection = await getAmqpConnection();

    const notifications: Array<unknown> = [];
    const worker = createWorker(orderContract, {
      processOrder: async () => {},
      notifyOrder: async (msg) => {
        notifications.push(msg);
      },
      shipOrder: async () => {},
      handleUrgentOrder: async () => {},
    });

    await worker.connect(amqpConnection);
    await worker.consume("notifyOrder");

    const clientConnection = await getAmqpConnection();
    const client = createClient(orderContract);
    await client.connect(clientConnection);

    // WHEN - Publish different types of order events
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

    // THEN - Should receive both events
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    // CLEANUP
    await worker.close();
    await client.close();
    try {
      await clientConnection.close();
    } catch {
      // Connection may already be closed
    }
  });

  it("should start all consumers with consumeAll", async () => {
    // GIVEN
    amqpConnection = await getAmqpConnection();

    const processedOrders: Array<unknown> = [];
    const notifications: Array<unknown> = [];
    const worker = createWorker(orderContract, {
      processOrder: async (msg) => {
        processedOrders.push(msg);
      },
      notifyOrder: async (msg) => {
        notifications.push(msg);
      },
      shipOrder: async () => {},
      handleUrgentOrder: async () => {},
    });

    await worker.connect(amqpConnection);

    // WHEN - Start all consumers
    await worker.consumeAll();

    const clientConnection = await getAmqpConnection();
    const client = createClient(orderContract);
    await client.connect(clientConnection);

    const newOrder = {
      orderId: "TEST-003",
      customerId: "CUST-789",
      items: [{ productId: "PROD-C", quantity: 1, price: 19.99 }],
      totalAmount: 19.99,
      createdAt: new Date().toISOString(),
    };

    await client.publish("orderCreated", newOrder);

    // THEN - All relevant handlers should be called
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(processedOrders.length).toBeGreaterThanOrEqual(1);
    expect(notifications.length).toBeGreaterThan(0); // Receives all events

    // CLEANUP
    await worker.close();
    await client.close();
    try {
      await clientConnection.close();
    } catch {
      // Connection may already be closed
    }
  });
});
