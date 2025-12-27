import { describe, expect } from "vitest";
import { OrderService } from "./order.service.js";
import { bootstrap } from "./bootstrap.js";
import { it } from "@amqp-contract/testing/extension";

describe("NestJS Client Integration", () => {
  it("should publish a new order successfully", async () => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      const orderService = app.get(OrderService);

      const newOrder = {
        orderId: "TEST-001",
        customerId: "CUST-123",
        items: [
          { productId: "PROD-A", quantity: 2, price: 29.99 },
          { productId: "PROD-B", quantity: 1, price: 49.99 },
        ],
        totalAmount: 109.97,
      };

      // WHEN
      const result = await orderService.createOrder(newOrder);

      // THEN
      expect(result).toEqual({ success: true });
    } finally {
      // CLEANUP
      await app.close();
    }
  });

  it("should publish order status updates", async () => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      const orderService = app.get(OrderService);

      // WHEN
      const result = await orderService.updateOrderStatus("TEST-001", "processing");

      // THEN
      expect(result).toEqual({ success: true });
    } finally {
      // CLEANUP
      await app.close();
    }
  });

  it("should publish shipment notifications", async () => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      const orderService = app.get(OrderService);

      // WHEN
      const result = await orderService.shipOrder("TEST-001");

      // THEN
      expect(result).toEqual({ success: true });
    } finally {
      // CLEANUP
      await app.close();
    }
  });

  it("should publish urgent updates", async () => {
    // GIVEN - Bootstrap the real application
    const app = await bootstrap();

    try {
      const orderService = app.get(OrderService);

      // WHEN
      const result = await orderService.urgentUpdate("TEST-002", "cancelled");

      // THEN
      expect(result).toEqual({ success: true });
    } finally {
      // CLEANUP
      await app.close();
    }
  });
});
