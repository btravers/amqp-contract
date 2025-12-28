import {
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers/index.js";
import { describe, expect, vi } from "vitest";
import type { INestApplicationContext } from "@nestjs/common";
import { it as baseIt } from "@amqp-contract/testing/extension";
import { bootstrap } from "./bootstrap.js";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

const it = baseIt.extend<{ app: INestApplicationContext }>({
  app: async ({ amqpConnectionUrl }, use) => {
    process.env["AMQP_URL"] = amqpConnectionUrl;
    const app = await bootstrap();
    await app.init();
    await use(app);
    await app.close();
  },
});

describe("NestJS Worker Integration", () => {
  it("should process new orders from order.created queue", async ({ app, publishMessage }) => {
    // GIVEN
    // Spy on the handler
    const processOrderHandler = app.get(ProcessOrderHandler);
    const handlerSpy = vi.spyOn(processOrderHandler, "handle");

    const newOrder = {
      orderId: "ORD-TEST-001",
      customerId: "CUST-123",
      items: [{ productId: "PROD-A", quantity: 2, price: 29.99 }],
      totalAmount: 59.98,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    publishMessage(
      orderContract.publishers.orderCreated.exchange.name,
      orderContract.publishers.orderCreated.routingKey!,
      newOrder,
    );

    // THEN
    await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1));
    expect(handlerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-TEST-001",
        customerId: "CUST-123",
      }),
    );
  });

  it("should notify on all order events", async ({ app, publishMessage }) => {
    // GIVEN
    // Spy on the handler
    const notifyHandler = app.get(NotifyOrderHandler);
    const handlerSpy = vi.spyOn(notifyHandler, "handle");

    const orderUpdate = {
      orderId: "ORD-TEST-002",
      status: "processing" as const,
      updatedAt: new Date().toISOString(),
    };

    // WHEN - Publish an order created event
    publishMessage(
      orderContract.publishers.orderUpdated.exchange.name,
      orderContract.publishers.orderUpdated.routingKey!,
      orderUpdate,
    );

    // THEN
    await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1));
    expect(handlerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-TEST-002",
        status: "processing",
      }),
    );
  });

  it("should handle shipped orders", async ({ app, publishMessage }) => {
    // GIVEN
    // Spy on the handler
    const shipHandler = app.get(ShipOrderHandler);
    const handlerSpy = vi.spyOn(shipHandler, "handle");

    const shippedOrder = {
      orderId: "ORD-TEST-003",
      status: "shipped" as const,
      updatedAt: new Date().toISOString(),
    };

    // WHEN
    publishMessage(
      orderContract.publishers.orderShipped.exchange.name,
      orderContract.publishers.orderShipped.routingKey!,
      shippedOrder,
    );

    // THEN
    await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1));
    expect(handlerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-TEST-003",
        status: "shipped",
      }),
    );
  });

  it("should handle urgent updates", async ({ app, publishMessage }) => {
    // GIVEN
    // Spy on the handler
    const urgentHandler = app.get(HandleUrgentOrderHandler);
    const handlerSpy = vi.spyOn(urgentHandler, "handle");

    const urgentUpdate = {
      orderId: "ORD-TEST-004",
      status: "cancelled" as const,
      updatedAt: new Date().toISOString(),
    };

    // WHEN
    publishMessage(
      orderContract.publishers.orderUrgentUpdate.exchange.name,
      orderContract.publishers.orderUrgentUpdate.routingKey!,
      urgentUpdate,
    );

    // THEN
    await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1));
    expect(handlerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-TEST-004",
        status: "cancelled",
      }),
    );
  });

  it("should process analytics from exchange-to-exchange binding", async ({
    app,
    publishMessage,
  }) => {
    // GIVEN
    // Spy on the handler
    const analyticsHandler = app.get(ProcessAnalyticsHandler);
    const handlerSpy = vi.spyOn(analyticsHandler, "handle");

    const newOrder = {
      orderId: "ORD-TEST-005",
      customerId: "CUST-456",
      items: [{ productId: "PROD-B", quantity: 1, price: 15.99 }],
      totalAmount: 15.99,
      createdAt: new Date().toISOString(),
    };

    // WHEN
    publishMessage(
      orderContract.publishers.orderCreated.exchange.name,
      orderContract.publishers.orderCreated.routingKey!,
      newOrder,
    );

    // THEN
    await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1));
    expect(handlerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ORD-TEST-005",
      }),
    );
  });
});
