import {
  HandleUrgentOrderHandler,
  NotifyOrderHandler,
  ProcessAnalyticsHandler,
  ProcessOrderHandler,
  ShipOrderHandler,
} from "./handlers/index.js";
import { describe, expect, vi } from "vitest";
import { TypedAmqpClient } from "@amqp-contract/client";
import { bootstrap } from "./bootstrap.js";
import { it } from "@amqp-contract/testing/extension";
import { orderContract } from "@amqp-contract-samples/basic-order-processing-contract";

describe("NestJS Worker Integration", () => {
  it("should process new orders from order.created queue", async ({ amqpConnectionUrl }) => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      await app.init();

      // Spy on the handler
      const processOrderHandler = app.get(ProcessOrderHandler);
      const handlerSpy = vi.spyOn(processOrderHandler, "handler");

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
        orderId: "ORD-TEST-001",
        customerId: "CUST-123",
        items: [{ productId: "PROD-A", quantity: 2, price: 29.99 }],
        totalAmount: 59.98,
        createdAt: new Date().toISOString(),
      };

      const publishResult = await client.publish("orderCreated", newOrder);
      if (publishResult.isError()) {
        throw publishResult.error;
      }

      // THEN - Wait for the message to be processed
      await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ORD-TEST-001",
          customerId: "CUST-123",
        }),
      );

      // CLEANUP
      await client.close();
    } finally {
      await app.close();
    }
  });

  it("should notify on all order events", async ({ amqpConnectionUrl }) => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      await app.init();

      // Spy on the handler
      const notifyHandler = app.get(NotifyOrderHandler);
      const handlerSpy = vi.spyOn(notifyHandler, "handler");

      const clientResult = await TypedAmqpClient.create({
        contract: orderContract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

      // WHEN - Publish an order created event
      const orderUpdate = {
        orderId: "ORD-TEST-002",
        status: "processing" as const,
        updatedAt: new Date().toISOString(),
      };

      const publishResult = await client.publish("orderUpdated", orderUpdate);
      if (publishResult.isError()) {
        throw publishResult.error;
      }

      // THEN
      await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ORD-TEST-002",
          status: "processing",
        }),
      );

      // CLEANUP
      await client.close();
    } finally {
      await app.close();
    }
  });

  it("should handle shipped orders", async ({ amqpConnectionUrl }) => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      await app.init();

      // Spy on the handler
      const shipHandler = app.get(ShipOrderHandler);
      const handlerSpy = vi.spyOn(shipHandler, "handler");

      const clientResult = await TypedAmqpClient.create({
        contract: orderContract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

      // WHEN
      const shippedOrder = {
        orderId: "ORD-TEST-003",
        status: "shipped" as const,
        updatedAt: new Date().toISOString(),
      };

      const publishResult = await client.publish("orderShipped", shippedOrder);
      if (publishResult.isError()) {
        throw publishResult.error;
      }

      // THEN
      await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ORD-TEST-003",
          status: "shipped",
        }),
      );

      // CLEANUP
      await client.close();
    } finally {
      await app.close();
    }
  });

  it("should handle urgent updates", async ({ amqpConnectionUrl }) => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      await app.init();

      // Spy on the handler
      const urgentHandler = app.get(HandleUrgentOrderHandler);
      const handlerSpy = vi.spyOn(urgentHandler, "handler");

      const clientResult = await TypedAmqpClient.create({
        contract: orderContract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

      // WHEN
      const urgentUpdate = {
        orderId: "ORD-TEST-004",
        status: "cancelled" as const,
        updatedAt: new Date().toISOString(),
      };

      const publishResult = await client.publish("orderUrgentUpdate", urgentUpdate);
      if (publishResult.isError()) {
        throw publishResult.error;
      }

      // THEN
      await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ORD-TEST-004",
          status: "cancelled",
        }),
      );

      // CLEANUP
      await client.close();
    } finally {
      await app.close();
    }
  });

  it("should process analytics from exchange-to-exchange binding", async ({
    amqpConnectionUrl,
  }) => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      await app.init();

      // Spy on the handler
      const analyticsHandler = app.get(ProcessAnalyticsHandler);
      const handlerSpy = vi.spyOn(analyticsHandler, "handler");

      const clientResult = await TypedAmqpClient.create({
        contract: orderContract,
        urls: [amqpConnectionUrl],
      });

      if (clientResult.isError()) {
        throw clientResult.error;
      }
      const client = clientResult.value;

      // WHEN - Publish any order event (will be forwarded to analytics)
      const newOrder = {
        orderId: "ORD-TEST-005",
        customerId: "CUST-456",
        items: [{ productId: "PROD-B", quantity: 1, price: 15.99 }],
        totalAmount: 15.99,
        createdAt: new Date().toISOString(),
      };

      const publishResult = await client.publish("orderCreated", newOrder);
      if (publishResult.isError()) {
        throw publishResult.error;
      }

      // THEN
      await vi.waitFor(() => expect(handlerSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(handlerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ORD-TEST-005",
        }),
      );

      // CLEANUP
      await client.close();
    } finally {
      await app.close();
    }
  });
});
