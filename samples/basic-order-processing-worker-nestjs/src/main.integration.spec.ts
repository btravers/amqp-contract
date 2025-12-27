import {
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers/index.js";
import { AmqpWorkerModule } from "@amqp-contract/worker-nestjs";
import { it } from "@amqp-contract/testing/extension";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";
import { TypedAmqpClient } from "@amqp-contract/client";
import { describe, expect, vi } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";

describe("NestJS Worker Integration", () => {
  it("should process new orders from order.created queue", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const processedOrders: Array<unknown> = [];
    const testProcessOrderHandler = async (msg: unknown) => {
      processedOrders.push(msg);
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpWorkerModule.forRoot({
          contract: orderContract,
          handlers: {
            processOrder: testProcessOrderHandler,
            notifyOrder: new NotifyOrderHandler().handler,
            shipOrder: new ShipOrderHandler().handler,
            handleUrgentOrder: new HandleUrgentOrderHandler().handler,
            processAnalytics: new ProcessAnalyticsHandler().handler,
          },
          urls: [amqpConnectionUrl],
        }),
      ],
    }).compile();

    await moduleRef.init();

    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

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
    await vi.waitFor(() => {
      expect(processedOrders).toHaveLength(1);
      expect(processedOrders[0]).toEqual(newOrder);
    });

    // CLEANUP
    await client.close().resultToPromise();
    await moduleRef.close();
  });

  it("should receive notifications for all order events", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const notifications: Array<unknown> = [];
    const testNotifyOrderHandler = async (msg: unknown) => {
      notifications.push(msg);
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpWorkerModule.forRoot({
          contract: orderContract,
          handlers: {
            processOrder: new ProcessOrderHandler().handler,
            notifyOrder: testNotifyOrderHandler,
            shipOrder: new ShipOrderHandler().handler,
            handleUrgentOrder: new HandleUrgentOrderHandler().handler,
            processAnalytics: new ProcessAnalyticsHandler().handler,
          },
          urls: [amqpConnectionUrl],
        }),
      ],
    }).compile();

    await moduleRef.init();

    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

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
    await vi.waitFor(() => {
      expect(notifications.length).toBeGreaterThanOrEqual(2);
    });

    // CLEANUP
    await client.close().resultToPromise();
    await moduleRef.close();
  });

  it("should handle shipped orders", async ({ amqpConnectionUrl }) => {
    // GIVEN
    const shippedOrders: Array<unknown> = [];
    const testShipOrderHandler = async (msg: unknown) => {
      shippedOrders.push(msg);
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        AmqpWorkerModule.forRoot({
          contract: orderContract,
          handlers: {
            processOrder: new ProcessOrderHandler().handler,
            notifyOrder: new NotifyOrderHandler().handler,
            shipOrder: testShipOrderHandler,
            handleUrgentOrder: new HandleUrgentOrderHandler().handler,
            processAnalytics: new ProcessAnalyticsHandler().handler,
          },
          urls: [amqpConnectionUrl],
        }),
      ],
    }).compile();

    await moduleRef.init();

    const clientResult = await TypedAmqpClient.create({
      contract: orderContract,
      urls: [amqpConnectionUrl],
    });

    if (clientResult.isError()) {
      throw clientResult.error;
    }
    const client = clientResult.value;

    const shippedOrder = {
      orderId: "TEST-003",
      status: "shipped" as const,
      updatedAt: new Date().toISOString(),
    };

    // WHEN
    const result = await client.publish("orderShipped", shippedOrder);
    expect(result.isOk()).toBe(true);

    // THEN
    await vi.waitFor(() => {
      expect(shippedOrders).toHaveLength(1);
      expect(shippedOrders[0]).toEqual(shippedOrder);
    });

    // CLEANUP
    await client.close().resultToPromise();
    await moduleRef.close();
  });
});
